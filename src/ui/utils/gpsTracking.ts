import { GPSPosition } from '../types';

export class GPSTracker {
  private watchId: number | null = null;
  private callbacks: ((position: GPSPosition) => void)[] = [];
  private errorCallbacks: ((error: GeolocationPositionError) => void)[] = [];

  /**
   * Startet GPS Tracking
   */
  startTracking(options?: PositionOptions): void {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by this browser');
    }

    const defaultOptions: PositionOptions = {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 1000,
      ...options,
    };

    this.watchId = navigator.geolocation.watchPosition(
      position => {
        const gpsPosition: GPSPosition = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude || undefined,
          heading: position.coords.heading || undefined,
          speed: position.coords.speed || undefined,
          timestamp: position.timestamp,
        };

        this.callbacks.forEach(callback => callback(gpsPosition));
      },
      error => {
        this.errorCallbacks.forEach(callback => callback(error));
      },
      defaultOptions
    );
  }

  /**
   * Stoppt GPS Tracking
   */
  stopTracking(): void {
    if (this.watchId !== null) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
    }
  }

  /**
   * Registriert Position Callback
   */
  onPositionUpdate(callback: (position: GPSPosition) => void): void {
    this.callbacks.push(callback);
  }

  /**
   * Registriert Error Callback
   */
  onError(callback: (error: GeolocationPositionError) => void): void {
    this.errorCallbacks.push(callback);
  }

  /**
   * Entfernt Callbacks
   */
  removeCallbacks(): void {
    this.callbacks = [];
    this.errorCallbacks = [];
  }

  /**
   * Checks whether GPS access is available.
   */
  static isSupported(): boolean {
    return 'geolocation' in navigator;
  }

  /**
   * Holt einmalige Position
   */
  static async getCurrentPosition(
    options?: PositionOptions
  ): Promise<GPSPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation is not supported'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        position => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude || undefined,
            heading: position.coords.heading || undefined,
            speed: position.coords.speed || undefined,
            timestamp: position.timestamp,
          });
        },
        reject,
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 1000,
          ...options,
        }
      );
    });
  }
}

/**
 * Keeps the display awake during navigation.
 */
export class ScreenWakeLock {
  private wakeLock: WakeLockSentinel | null = null;

  async request(): Promise<void> {
    try {
      if ('wakeLock' in navigator) {
        this.wakeLock = await navigator.wakeLock.request('screen');

        // Resume tracking when the app becomes visible again.
        document.addEventListener('visibilitychange', async () => {
          if (
            this.wakeLock !== null &&
            document.visibilityState === 'visible'
          ) {
            this.wakeLock = await navigator.wakeLock.request('screen');
          }
        });
      }
    } catch (error) {
      console.warn('Wake Lock request failed:', error);
    }
  }

  release(): void {
    if (this.wakeLock) {
      this.wakeLock.release();
      this.wakeLock = null;
    }
  }

  static isSupported(): boolean {
    return 'wakeLock' in navigator;
  }
}

/**
 * Reads device orientation for the compass.
 */
export class CompassTracker {
  private callbacks: ((heading: number) => void)[] = [];
  private isTracking = false;
  private handlerRef: ((e: DeviceOrientationEvent) => void) | null = null;
  // Separate listener for Chrome Android's deviceorientationabsolute event
  private absoluteHandlerRef: ((e: DeviceOrientationEvent) => void) | null =
    null;
  // Set to true once absolute data has been received so the relative
  // deviceorientation fallback stays silent on Chrome Android.
  private hasAbsoluteSource = false;

  startTracking(): void {
    if (this.isTracking) return;
    // Permission must be handled by the caller before invoking startTracking().
    // On iOS this means calling CompassTracker.requestPermission() inside a
    // user-gesture handler first.  On Android / non-iOS no permission is needed.
    if ('DeviceOrientationEvent' in window) {
      this.setupOrientationListener();
    }
  }

  private setupOrientationListener(): void {
    this.handlerRef = this.handleOrientation.bind(this);
    // Chrome Android fires `deviceorientationabsolute` with Earth-frame data.
    // Register it first so we can suppress the less-reliable relative
    // `deviceorientation` fallback once we know absolute data is available.
    this.absoluteHandlerRef = this.handleAbsoluteOrientation.bind(this);
    if ('ondeviceorientationabsolute' in window) {
      window.addEventListener(
        'deviceorientationabsolute' as any,
        this.absoluteHandlerRef
      );
    }
    window.addEventListener('deviceorientation', this.handlerRef);
    this.isTracking = true;
  }

  /**
   * Computes a compass heading (0-360°, clockwise from North) from
   * absolute DeviceOrientation angles using the W3C worked-example formula.
   * Accurate regardless of whether the device is held flat or upright.
   * See https://www.w3.org/TR/orientation-event/#worked-example
   */
  private static computeCompassHeading(
    alpha: number,
    beta: number,
    gamma: number
  ): number {
    // 2023 approximation that is well-behaved for all common device positions
    // (flat on table, held upright, mounted at an angle).
    // Reference: https://stackoverflow.com/a/75793028
    let compass = -(alpha + (beta * gamma) / 90);
    // Wrap to [0, 360)
    compass = ((compass % 360) + 360) % 360;
    return compass;
  }

  /** Handler for Chrome Android's deviceorientationabsolute event. */
  private handleAbsoluteOrientation(event: DeviceOrientationEvent): void {
    if (event.alpha === null || event.beta === null || event.gamma === null)
      return;
    this.hasAbsoluteSource = true;
    const heading = CompassTracker.computeCompassHeading(
      event.alpha,
      event.beta,
      event.gamma
    );
    this.callbacks.forEach(cb => cb(heading));
  }

  private handleOrientation(event: DeviceOrientationEvent): void {
    const anyEvent = event as any;
    let heading: number | null = null;

    // iOS Safari: webkitCompassHeading is a direct magnetic north heading.
    if (typeof anyEvent?.webkitCompassHeading === 'number') {
      heading = anyEvent.webkitCompassHeading as number; // 0..360, CW from N
    } else if (
      !this.hasAbsoluteSource &&
      event.absolute === true &&
      event.alpha !== null &&
      event.beta !== null &&
      event.gamma !== null
    ) {
      // Non-iOS browser that delivers absolute data via the regular
      // deviceorientation event (e.g. some Android browsers).
      heading = CompassTracker.computeCompassHeading(
        event.alpha,
        event.beta,
        event.gamma
      );
    }
    // Relative (non-absolute) events without webkitCompassHeading are not
    // usable as a compass heading: they drift because they are not
    // referenced to magnetic north.

    if (heading !== null && !Number.isNaN(heading)) {
      this.callbacks.forEach(callback => callback(heading as number));
    }
  }

  stopTracking(): void {
    if (this.isTracking) {
      if (this.handlerRef) {
        window.removeEventListener('deviceorientation', this.handlerRef);
        this.handlerRef = null;
      }
      if (this.absoluteHandlerRef) {
        window.removeEventListener(
          'deviceorientationabsolute' as any,
          this.absoluteHandlerRef
        );
        this.absoluteHandlerRef = null;
      }
      this.hasAbsoluteSource = false;
      this.isTracking = false;
    }
  }

  onHeadingUpdate(callback: (heading: number) => void): void {
    this.callbacks.push(callback);
  }

  removeCallbacks(): void {
    this.callbacks = [];
  }

  static isSupported(): boolean {
    return (
      'DeviceOrientationEvent' in window && 'ondeviceorientation' in window
    );
  }

  /**
   * Returns true on iOS 13+ where DeviceOrientationEvent.requestPermission() exists.
   * On these devices permission MUST be requested inside a user-gesture handler.
   */
  static requiresPermission(): boolean {
    return (
      'DeviceOrientationEvent' in window &&
      typeof (DeviceOrientationEvent as any).requestPermission === 'function'
    );
  }

  /**
   * Requests device-orientation permission on iOS 13+.
   * MUST be called synchronously from within a user-gesture event handler.
   * Returns true when granted (or when no permission is needed).
   */
  static async requestPermission(): Promise<boolean> {
    if (!CompassTracker.requiresPermission()) return true;
    try {
      const result = await (DeviceOrientationEvent as any).requestPermission();
      return result === 'granted';
    } catch {
      return false;
    }
  }
}
