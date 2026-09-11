/* Ad-network adapter contract. No network is configured by default.
 * Replace this adapter with your approved SDK integration.
 * isAvailable(kind): synchronous boolean; kind is 'revive', 'helium', or 'interstitial'.
 * showRewarded(kind, {signal}): Promise<{completed:boolean}>.
 * Resolve completed:true ONLY from the SDK's verified reward-earned callback.
 * showInterstitial({signal}): Promise<{shown:boolean}>; resolve after the ad closes.
 * Honor signal cancellation, close/stop playback on abort, and resolve on no-fill/error.
 * The SDK determines video duration. Never simulate watching or reward completion.
 * Mount an approved banner in #landingAd and unhide it when filled.
 */
window.PuffAds ??= Object.freeze({
  isAvailable: () => false,
  showRewarded: async () => ({ completed: false }),
  showInterstitial: async () => ({ shown: false }),
});
