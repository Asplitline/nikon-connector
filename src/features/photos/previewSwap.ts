export function resolvePreviewSwapState({
  loadedPreviewUrl,
  previewUrl,
  thumbnailUrl,
  visibleUrl,
}: {
  loadedPreviewUrl: string | null;
  previewUrl: string;
  thumbnailUrl: string;
  visibleUrl: string;
}) {
  if (!previewUrl) {
    return {
      isLoadingUpgrade: Boolean(thumbnailUrl),
      preloadUrl: null,
      visibleUrl: thumbnailUrl,
    };
  }

  if (!thumbnailUrl || visibleUrl === previewUrl || loadedPreviewUrl === previewUrl) {
    return {
      isLoadingUpgrade: false,
      preloadUrl: null,
      visibleUrl: previewUrl,
    };
  }

  return {
    isLoadingUpgrade: true,
    preloadUrl: previewUrl,
    visibleUrl: visibleUrl || thumbnailUrl,
  };
}
