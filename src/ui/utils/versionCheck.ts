import packageMetadata from '../../../package.json';

export const getLocalVersion = () => ({
  appVersion: packageMetadata.version,
  buildVersion: null,
});
