export const IOS_STARTUP_IMAGES = [
  {
    url: "/startup/ios/habitat-v1-640x1136.png",
    media:
      "(device-width: 320px) and (device-height: 568px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    url: "/startup/ios/habitat-v1-750x1334.png",
    media:
      "(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    url: "/startup/ios/habitat-v1-1242x2208.png",
    media:
      "(device-width: 414px) and (device-height: 736px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    url: "/startup/ios/habitat-v1-1125x2436.png",
    media:
      "(device-width: 375px) and (device-height: 812px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    url: "/startup/ios/habitat-v1-828x1792.png",
    media:
      "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait)",
  },
  {
    url: "/startup/ios/habitat-v1-1242x2688.png",
    media:
      "(device-width: 414px) and (device-height: 896px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    url: "/startup/ios/habitat-v1-1170x2532.png",
    media:
      "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    url: "/startup/ios/habitat-v1-1284x2778.png",
    media:
      "(device-width: 428px) and (device-height: 926px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    url: "/startup/ios/habitat-v1-1179x2556.png",
    media:
      "(device-width: 393px) and (device-height: 852px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    url: "/startup/ios/habitat-v1-1290x2796.png",
    media:
      "(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    url: "/startup/ios/habitat-v1-1206x2622.png",
    media:
      "(device-width: 402px) and (device-height: 874px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    url: "/startup/ios/habitat-v1-1320x2868.png",
    media:
      "(device-width: 440px) and (device-height: 956px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
  {
    url: "/startup/ios/habitat-v1-1260x2736.png",
    media:
      "(device-width: 420px) and (device-height: 912px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait)",
  },
] satisfies Array<{ url: string; media: string }>;

export const IOS_STARTUP_PROFILE_COOKIE = "habitat-startup-size";

export function getIosStartupImage(profile?: string) {
  return IOS_STARTUP_IMAGES.find(
    ({ url }) => url === `/startup/ios/habitat-v1-${profile}.png`,
  );
}

// The home-screen installer needs the unconditional link in server-rendered HTML.
// Persist the supported screen profile, then reload once so the server can emit it.
export const IOS_STARTUP_IMAGE_SCRIPT = `(() => {
  const images = ${JSON.stringify(IOS_STARTUP_IMAGES)};
  const image = images.find(({ media }) => window.matchMedia(media).matches);
  if (!image) return;
  const profile = image.url.match(/(\\d+x\\d+)\\.png$/)[1];
  const cookie = "${IOS_STARTUP_PROFILE_COOKIE}=" + profile;
  const hasProfile = () => document.cookie.split(";").some(part => part.trim() === cookie);
  if (hasProfile()) return;
  document.cookie = cookie + "; Path=/; Max-Age=31536000; SameSite=Lax; Secure";
  if (hasProfile()) window.location.reload();
})();`;
