// Free-signing builds (GETGO_FREE_SIGNING=1) can't use HealthKit: don't link its native code at all there.
const free = process.env.GETGO_FREE_SIGNING === '1';

module.exports = {
  dependencies: free
    ? {
        '@kingstinct/react-native-healthkit': { platforms: { ios: null, android: null } },
        '@react-native-healthkit/core': { platforms: { ios: null, android: null } },
      }
    : {},
};
