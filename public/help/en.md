# Using RoadbookNavi

Plan a trip, turn it into a roadbook and take it on your motorcycle, in your car or on your bicycle. You do not need an account.

## Find your task

- **I have an idea for a trip:** [From an idea to a roadbook](#from-an-idea-to-a-roadbook).
- **I want a different name:** [Rename a roadbook](#rename-a-roadbook).
- **I want to remove a roadbook:** [Delete a roadbook](#delete-a-roadbook).
- **I need a file to take with me:** [Export a roadbook](#export-a-roadbook).
- **Someone sent me a GPX file:** [Use a GPX template](#use-a-gpx-template).
- **Someone sent me an RN2 file:** [Open a roadbook you received](#open-a-roadbook-you-received).
- **I am ready to ride:** [Prepare for a trip](#prepare-for-a-trip).
- **Something is wrong:** [Solve a problem](#solve-a-problem).

This guide covers the web version and the installed app. Differences are explained where they matter. The screenshots show a real example in Germany's Eifel region: **Adenau → Nürburg**. Click or tap a small image to open the full screenshot. Orange arrows point to the controls being described. The pictures use the German interface; the instructions give the corresponding English button names.

## From an idea to a roadbook

**Example:** You want to ride from Adenau to Nürburg and create a roadbook for the trip.

1. Open **Route Planning** using the map icon at the bottom.
2. Select **New Roadbook**.
3. Choose a supplied **Routing Profile**. This example uses **enduro-easy**. The profile influences the route; check that the result suits your vehicle and trip.
4. Search for **Adenau**, or move the map to your starting point. Add your first waypoint.
5. Search for **Nürburg**, or add your destination on the map. With at least two points, the app calculates their connection.
6. Check the route. Add intermediate points to include a particular place or road.
7. Click the green **Save Roadbook** button.
8. Enter a useful name, such as **Eifel: Adenau – Nürburg**, and confirm with **Save**.
9. Wait for the roadbook to appear. The first creation can take longer while the app prepares data and intersection drawings.

[![Route planner: arrow 1 points to the routing profile, arrow 2 to the waypoints and arrow 3 to Save Roadbook.](images/planning-small.jpg)](images/planning.jpg)

_1: Choose a profile. 2: Check the start and destination. 3: Create and save your roadbook._

[![Save dialog with Eifel: Adenau – Nürburg as the name. Arrows point to the name field and Save.](images/create-small.jpg)](images/create.jpg)

_This saves a project in the app. Exporting a file is a separate step._

**Result:** Your project is in **Routes List**, ready to open with **Load & Navigate**.

## Rename a roadbook

**Example:** Change “Eifel: Adenau – Nürburg” to “Eifel: Sunday ride”.

1. Open **Route Planning**.
2. Choose your saved project under **Select Roadbook**.
3. Open the small **Roadbook Actions** cog beside the selection.
4. Choose **Rename**.
5. Enter the new name and confirm with **Save**.

[![Roadbook Actions: arrow 1 points to the cog and arrow 2 to Rename.](images/actions-small.jpg)](images/actions.jpg)

[![Rename dialog with a new name. Arrows point to the name and Save.](images/rename-small.jpg)](images/rename.jpg)

_This changes the project name in the app. Previously exported files keep their existing filenames._

## Delete a roadbook

**Example:** You no longer need an old test route.

If you might want it again, [export an RN2 backup first](#export-a-roadbook).

1. Open **Route Planning**.
2. Select the roadbook you want to remove.
3. Open the **Roadbook Actions** cog beside the selection.
4. Choose **Delete**.
5. Check the selected roadbook at the top left, then confirm the deletion in the dialog.

[![Delete dialog: arrow 1 points to the selected roadbook at the top left and arrow 2 to Delete.](images/delete-small.jpg)](images/delete.jpg)

> There is no recycle bin. **Routes List → Options → Delete** currently removes the project immediately, without another confirmation dialog. Exported files on your device are not deleted.

## Export a roadbook

**Example:** You plan on a computer and want to use the roadbook on another device or print it.

1. Open **Routes List** using the list icon at the bottom.
2. Find your roadbook.
3. Click the floppy-disk **Save** icon. Alternatively, use **Options → Export...**.
4. Choose a format.
5. Click **Export...** and wait for the file.
6. In the web version, find it in your browser's downloads. The installed app lets you choose a destination.

[![Routes List: arrow 1 points to Load & Navigate, arrow 2 to the export icon and arrow 3 to Options.](images/library-small.jpg)](images/library.jpg)

[![Export dialog with RN2, A5 PDF, roll PDF, GPX and GeoJSON. Arrows point to the format choices and Export.](images/export-small.jpg)](images/export.jpg)

| I want to …                                                     | Choose                         |
| --------------------------------------------------------------- | ------------------------------ |
| Back up a roadbook or open it in RoadbookNavi on another device | **RallyNavigator (\*.rn2)**    |
| Print individual pages                                          | **PDF (\*.pdf, A5 Portrait)**  |
| Use a continuous paper roll                                     | **PDF (\*.pdf, endless roll)** |
| Use the track in another mapping or navigation app              | **GPX Track (\*.gpx)**         |
| Use the track in a program that supports GeoJSON                | **GeoJSON (\*.geojson)**       |

**RN2** contains roadbook entries and drawings. **GPX and GeoJSON** contain the track, rather than the complete roadbook. **PDF** is for reading or printing.

For an A5 PDF, choose an appropriate paper size and check the print preview. A roll PDF needs print settings that suit your printer and roll.

## Open or install the app

[Start RoadbookNavi in your browser](https://roadbooknavi.de/app/) or [download the installed app](https://roadbooknavi.de/#download).

| Device                            | Download                                     |
| --------------------------------- | -------------------------------------------- |
| Windows PC with an x64 processor  | Windows **.exe** installer                   |
| Mac with Apple Silicon            | macOS **.dmg**                               |
| Linux PC with an x86_64 processor | **.AppImage**, or **.deb** for Debian/Ubuntu |
| Android device with ARM64         | Android **.apk**                             |
| iPhone or iPad                    | Browser version; there is no native iOS app  |

Open the downloaded file and follow your operating system's installation steps. On a Mac, drag the app from the opened DMG into **Applications**. On Linux, an AppImage must be executable. On Android, open the APK to start installation.

**Which version should I use?** The basic controls are the same. The browser needs internet for new routes. The installed app can calculate routes without a connection when the required area data is already downloaded. Prepare your first trip at home with a connection.

## Find your way around

The bottom icons give access to:

| Icon          | Opens                                                  |
| ------------- | ------------------------------------------------------ |
| Book          | **Roadbook** for reading and navigation                |
| Map           | **Route Planning** with waypoints and profiles         |
| List          | **Routes List** with saved projects, import and export |
| Cog           | **Settings** for display and controls                  |
| Question mark | This **Help** guide                                    |

Use **Back to the app** in the help navigation to return to your previous view. Reading help does not reset your odometer.

The roadbook view has two extra switches at the bottom left: the **location icon for auto-follow** and the **ruler icon to show or hide the odometer area**.

## Adjust waypoints and the route

### Add points on the map

Click or tap a location. The first point is your start and the last is your destination. You need at least two points.

A new point may be inserted into a suitable existing route segment. Check the numbered list afterwards: its order determines the route.

### Move or remove points

- **Move:** Drag a marker to its new location.
- **Remove:** Click a marker, or the **×** beside its list entry.
- **Reorder:** Drag the handle on the left of a list entry up or down.
- **Insert an intermediate point:** Click the route.
- **Change the path:** Drag a route segment to a different location, creating another waypoint.

[![Waypoint list: arrow 1 points to the reorder handle and arrow 2 to the remove button.](images/waypoints-small.jpg)](images/waypoints.jpg)

The app recalculates after a change. Clicking an existing marker removes it; drag it when you want to move it.

### Adjust a saved route

Select it in the planner or use **Routes List → Options → Edit**. Change the points or profile, then choose **Save Changes**. While changes are pending, the red **X** beside the green save button discards them.

This changes the route. There is no drawing or text editor for individual tulip diagrams or instructions.

### Create a variant

Select the project in the planner and use **Roadbook Actions → Duplicate**. This creates a separate project for a route variant. To preserve a complete imported RN2 roadbook as a backup, use RN2 export.

## Search for places and use your location

1. Type at least three characters in the address search, such as **Adenau**.
2. Press **Enter** or click **Search**.
3. Select a result to add it as a waypoint.

Search runs after you submit it, rather than while you type.

[![Address search for Adenau: arrow 1 points to the search field, arrow 2 to Search and arrow 3 to a result.](images/search-small.jpg)](images/search.jpg)

**Add Current Position** adds a waypoint at your location. The location icon on the right of the map instead moves the map to your position. Both need a location from your device and permission to use it.

Address search needs a connection and enabled **Online Place Search**. You can still place points directly on the map without search.

## Choose a routing profile and map

A routing profile determines how waypoints are connected. It does not change roadbooks you have already printed.

The web version offers **trekking** and the supplied Enduro profiles **enduro-easy**, **enduro-medium**, **enduro-hard**, **enduro** and **enduro_new**. The installed app may offer additional bundled BRouter profiles.

Try a profile, inspect the result and compare another if necessary. A profile name is not a reliable promise of actual difficulty or suitability. You cannot add your own profile files through the interface.

The map icon on the right offers **Liberty**, **Bright**, **Positron**, **Dark**, **Fiord**, **Liberty 3D** and **Natural Earth · Relief**. A map style changes the display, not the route. Relief is for a broad overview.

[![Map-style selection: the arrow points to the menu of available map displays.](images/map-small.jpg)](images/map.jpg)

Use **+ / −** to zoom and the compass icon to face north. Set a default map and profile under **Settings → App**.

## Check distance and surfaces

Open **Details (i)** next to the green save button. It shows the route length, estimated offroad percentage and the lengths of the detected surfaces. Route colours correspond to those surfaces.

[![Route analysis for the Eifel example. Arrows point to Details and the surface breakdown.](images/analysis-small.jpg)](images/analysis.jpg)

These figures depend on available map data. Missing surface information may be estimated from other road characteristics. **Unknown does not mean offroad.** Check important sections before the trip.

## Use a GPX template

**Example:** Someone sent you a GPX track for an Eifel ride and you want a roadbook.

1. Open **Route Planning → New Roadbook**.
2. Click **Import GPX Template**.
3. Select the **.gpx** file.
4. Compare the original track underlay with the newly calculated route.
5. Choose a suitable profile and move or add points where needed.
6. Click **Save Roadbook**, give it a name and confirm.

[![GPX template: the arrow points to Import GPX Template in the planner.](images/gpx-small.jpg)](images/gpx.jpg)

> GPX is a template. The app simplifies the track, extracts waypoints and calculates their connections again. Your roadbook can therefore differ from the original track. Check the route before saving.

Import GPX in the **planner**. **Open (.rn2)** in Routes List is for RN2 roadbooks.

## Open a roadbook you received

1. Save the **.rn2** file on your device.
2. Open **Routes List**.
3. Choose **Open (.rn2)** and select the file.
4. Read the import notice and confirm.
5. Open the imported project with **Load & Navigate**.

[![RN2 import: the arrow points to Open (.rn2) in Routes List.](images/import-small.jpg)](images/import.jpg)

RN2 version 4 is supported. Known symbols and embedded images are retained. Unavailable symbols may appear as names or replacement drawings. External image references are not downloaded.

**Compare with the original before riding:** Manual RN2 distance corrections and smart tags are not currently evaluated. Displayed distances come from the GPS track.

Unchanged original drawings are retained in RN2 exchange. If you change an imported route, affected intersection drawings may be regenerated. Export a backup first and keep the received original file.

## Read a roadbook

A roadbook describes your route as a sequence of entries. Follow them in order.

[![The Eifel roadbook: arrow 1 points to distances, arrow 2 to a tulip diagram and arrow 3 to the information column with the CAP direction.](images/roadbook-small.jpg)](images/roadbook.jpg)

- **Entry number:** Matches the number used in the navigation display.
- **Large distance:** Total distance from the start to this entry.
- **Small number at the bottom right:** Distance to the next entry. For example, a total of 128 m plus 426 m to the next entry gives that entry's total of 554 m.
- **Tulip diagram:** A schematic intersection. The dot marks the approach and the arrow the exit. The drawing is not a north-oriented map.
- **CAP in an entry:** Planned direction at that location, in degrees. This differs from the current heading in the switchable navigation field.
- **Notes and symbols:** Additional information for this entry, taken from the file for imported roadbooks.

**Example:** The odometer reads 2.30 km and the next entry is at 2.50 km: about 200 m remain to its roadbook distance. The navigation display can show a different distance because it measures directly to the target point.

## Prepare for a trip

1. Open **Routes List → Load & Navigate**.
2. Wait until the roadbook is visible.
3. Allow location access and check that coordinates appear.
4. At the start, check the odometer against the roadbook.
5. Enable **auto-follow** if wanted.
6. Test touch, keyboard or handlebar controls before setting off.
7. If you will be offline, complete the [offline check](#travel-without-internet).

The app requests location when opened. There is no separate “start navigation” button to press first. Opening a roadbook again from the list, or switching to another roadbook, starts the odometer at zero.

Keep the app open and visible. Reliable progress is not guaranteed with a locked screen, in the background or without a location signal. Make adjustments at a suitable stopping point.

## Set and correct the odometer

The **odometer** counts distance travelled. It displays metres below 1 km and kilometres afterwards. It advances from location readings while you move.

[![Odometer: arrow 1 points to the left half for decreasing the reading and arrow 2 to the right half for increasing it.](images/odometer-small.jpg)](images/odometer.jpg)

- **Tap the left half:** Subtract 10 m.
- **Tap the right half:** Add 10 m.
- **Hold:** Keep changing the reading.
- **Keyboard defaults:** **←** decreases and **→** increases it.

**Example:** At a recognisable entry, the roadbook says 3.20 km but the odometer reads 3.16 km. Tap the right half four times to add 40 m.

If hidden, show the display with the **ruler icon** at the bottom. Under **Settings → Interface → Odometer Position**, choose **Automatic**, **Left** or **Top**.

## Auto-follow and scrolling

The **location icon at the bottom left** turns auto-follow on and off. When enabled, the roadbook follows the odometer and moves to the upcoming entry. Correcting the odometer also changes which entry it targets.

[![Roadbook navigation: arrow 1 points to auto-follow and arrow 2 to the ruler switch that shows or hides the displays.](images/follow-small.jpg)](images/follow.jpg)

To browse ahead or back yourself, **turn auto-follow off with this icon**. Then scroll by touch, mouse wheel or your configured keys.

Under **Settings → App**, choose:

- **Step-by-step (Entries):** **↑ / ↓** moves to the previous or next entry.
- **Continuous:** Hold a scroll key for smooth movement. Adjust its speed below.

Turn auto-follow on again using the location icon when you want the roadbook to follow the odometer.

## Switch the navigation display

Tap the information field beside or below the odometer. Each tap changes to the next view:

1. **Next entry:** Number, direct distance to the target point and direction arrow.
2. **Speed:** km/h, if supplied by the device.
3. **GPS:** Latitude and longitude.
4. **Finish:** Direct distance and direction to the roadbook's destination.
5. **North arrow:** Direction of north.
6. **CAP:** Current direction of travel or compass heading in degrees.

[![Navigation field in CAP mode. The arrow points to the area you tap to change views.](images/dashboard-small.jpg)](images/dashboard.jpg)

**Direct distance means straight-line distance.** “Next entry” and “Finish” do not show distance remaining along the route. Target selection uses the roadbook and odometer. If you leave the route, check the route and correct the odometer yourself; this display does not replace planning a new route.

Fields may be blank or show **—** without usable location data. Direction indicators depend on the location and compass readings supplied by the device.

## Set up keyboard or handlebar controls

A handlebar controller can work if it presents itself to your device as a keyboard.

1. Connect it to your device.
2. Open **Settings → App**.
3. Click the key shown for **Decrease Odometer**, **Increase Odometer**, **Scroll Roadbook Up** or **Scroll Roadbook Down**.
4. Press the desired keyboard or controller key.
5. Use different keys for different actions.
6. Open the roadbook and test while stationary.

[![Key settings: arrows point to the buttons for changing odometer and scrolling keys.](images/keys-small.jpg)](images/keys.jpg)

Defaults are **← / →** for the odometer and **↑ / ↓** for scrolling. Single keys are supported; combinations with Ctrl, Alt, Shift or Cmd are not intended for these bindings. Use the location switch in the roadbook view for auto-follow.

## Adjust display and settings

Under **Settings → Interface**:

- **Theme Mode:** Light, Dark or System.
- **Language:** German or English.
- **Odometer Position:** Automatic based on orientation, always Left or always Top.

[![Interface settings: arrows point to theme, language and odometer position.](images/appearance-small.jpg)](images/appearance.jpg)

**Settings → App** also contains **Keep Screen On**, default map/profile, key bindings, scroll mode and speed. Keeping the screen awake depends on device or browser support.

The **Close Distance Threshold** slider can be set between **100 and 1000 m**. The current PDF's green distance cells indicate entries within **200 m of the previous entry**. This PDF highlighting always uses 200 m and does not change with the slider. A downward arrow in a distance cell indicates a similarly close next entry.

[![Close-distance settings with an arrow pointing to the adjustable slider.](images/threshold-small.jpg)](images/threshold.jpg)

### Online place search

Under **Settings → App → Online Place Search**, enable or disable lookup. If you use another compatible provider, enter its **Nominatim Service URL** and, if required, your own API key. Use **Test Connection** to check its response.

[![Online place search: arrows point to the enable switch and Test Connection.](images/search-settings-small.jpg)](images/search-settings.jpg)

Without online lookup, you can still place points on the map; automatic place names may be replaced by coordinates.

## Find and back up your roadbooks

In **Routes List**, filter by name and sort by date, name or length. Date means last modification; unknown lengths sort last.

Projects stay on this device. Web projects also belong to this particular browser and website. A roadbook-view link does not transfer a project to another device.

**Back up regularly:** Export important roadbooks as **RN2** and keep the files elsewhere, such as in your own file backup. Private browsing and clearing website data can remove web projects. Use RN2 backups before removing app data or changing devices.

## Take a roadbook to another device

**Example:** Plan on your laptop and ride with your Android phone.

1. Export the finished roadbook as **RN2** on the laptop.
2. Transfer the file to your phone using your preferred file transfer method or personal storage.
3. Open RoadbookNavi on the phone.
4. Import using **Routes List → Open (.rn2)**.
5. Open it once with **Load & Navigate**.
6. Complete the offline check before travelling.

There is no account or automatic synchronisation. Later laptop changes require another export and import on the other device.

## Travel without internet

| Task                                             | Web version                                    | Installed app                                                 |
| ------------------------------------------------ | ---------------------------------------------- | ------------------------------------------------------------- |
| View a previously generated roadbook             | Possible while the app remains open and loaded | Possible with the local roadbook                              |
| Start the app without a connection               | Not supported                                  | Supported                                                     |
| Calculate new routes                             | Needs internet                                 | Possible with the required previously downloaded routing data |
| Generate new intersection drawings               | Missing data needs internet                    | Missing data needs internet                                   |
| Reload the planning map or search for new places | Needs internet                                 | Needs internet                                                |

### Offline check before a trip

1. Create or import the roadbook at home with a connection.
2. Open it using **Load & Navigate**.
3. Browse the entries and check the drawings.
4. Temporarily disconnect internet. Keep the web app open.
5. Check roadbook display, scrolling and location access.
6. Restore your preferred connection before departure or remain offline after a successful check.

The installed app downloads missing area data automatically during calculation and reuses it later. Saving one route does not guarantee that any new route nearby can be calculated offline.

## Manage storage and reset the app

Under **Settings → App**, these actions have different effects:

[![Storage settings: arrows point to geographic data, roadbook previews and the app reset button.](images/storage-small.jpg)](images/storage.jpg)

| Action                                     | Effect                                                                                                          |
| ------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| **OpenFreeMap Tiles → Delete Data**        | Removes downloaded intersection data. It may need downloading again.                                            |
| **BRouter Routing Segments → Delete Data** | Removes local routing data. New native calculations may need internet. The web version stores no such segments. |
| **Clear Previews**                         | Removes generated PDF previews. Projects remain; their display must be prepared again.                          |
| **Reset App & Reload**                     | Resets settings and previews. Saved projects and geographic caches remain.                                      |
| **Delete Roadbook**                        | Removes that project. Restoring it later requires an exported file.                                             |

Clear data at home with a connection so required content can be downloaded again. **Clearing browser website data** differs from the app's reset button and can also remove your saved web roadbooks.

## Updates and support

In the installed app, open **Settings → About → Check for Updates**. If an update exists, **Download New Version** opens its download page. Download and install the correct package; the button does not install it automatically.

Reload the web version with a connection to update it. Export important projects as RN2 backups first.

For a report, note the device, operating system, browser or app version and steps to reproduce. Find the displayed version under **Settings → About**. Use [GitHub Issues](https://github.com/pcace/RoadbookNavi/issues) for problems or suggestions. Remove personal details from screenshots or files you upload publicly.

## Solve a problem

### I cannot get a location

Check location permission for the app or website and your device's location service. Use RoadbookNavi's HTTPS address in a browser. Try an open view of the sky and keep the app in the foreground. A desktop computer may not supply a usable GPS location.

**Access denied** suggests permission; **Timeout** or **Position unavailable** can mean no signal. You can still view the map and saved roadbooks.

### The odometer does not match

At a recognisable entry, compare the distances while stationary and adjust using the left or right half. Check the start reading after switching roadbooks. Long location outages can require a correction.

### Auto-follow targets the wrong entry

Check the odometer first. Turn auto-follow off, browse to the correct entry and compare its distance. Correct the odometer, then enable auto-follow again.

### Place search finds nothing

Submit with **Enter** or **Search**. Check internet and **Settings → App → Online Place Search → Test Connection**. Try a more specific name or place points directly on the map.

### The route will not calculate

Check that there are at least two points on suitable roads. Move a problematic point slightly or try another supplied profile. The browser needs internet; the installed app needs to download missing area data first.

### The roadbook stays blank or reports a PDF error

Wait for creation to finish, then open the saved project again from Routes List. If necessary, clear only **Roadbook Previews** under **Settings → App** and reopen with a connection. Export important projects as RN2 before trying more extensive recovery steps.

### My roadbook is missing on another device

Libraries are not synchronised. Export an RN2 file from the original device and import it on the second. Copying a link is not sufficient.

### I cannot find my exported file

Check browser downloads or the folder selected in the save dialog. **Save Roadbook** in the planner creates a project inside the app; exporting from Routes List creates a file.

## Where does my data go?

Projects stay local. There is no RoadbookNavi account and no automatic upload of your library.

- **Web routing:** Waypoints and the chosen profile go to brouter.de.
- **Installed app:** Routes are calculated on the device. Missing routing and intersection data is downloaded.
- **Maps and intersection data:** Required content comes from OpenFreeMap.
- **Online place search:** Search text and coordinates go to the configured provider. You can disable lookup.

**Other ways to read:** [Deutsch](de.md) · [Markdown on GitHub](https://github.com/pcace/RoadbookNavi/blob/main/public/help/en.md) · [RoadbookNavi website](https://roadbooknavi.de/)

_Updated 1 November 2026. Screenshots show the German web interface; the main controls are in the same places in the installed app._
