# Nikon SDK Rating Capability Probe: Z6III

## Evidence status

No Nikon SDK files are installed in this repository. The expected vendor
directory is `src-tauri/vendor/NikonSDK/`, but it currently contains no
headers, libraries, samples, or version manifest.

The existing bridge documentation names Nikon Remote Module SDK 2.0.0 as the
expected package, but the installed SDK version is therefore **unconfirmed**.
No header or API names were discovered, and support for writing camera-visible
0-5 star ratings on a Z6III is **unconfirmed**.

## Capability probe

`nikon_sdk::rating_write_back_available()` checks for both of these concrete
paths:

```text
src-tauri/vendor/NikonSDK/include/NikonSDK.h
src-tauri/vendor/NikonSDK/lib/libNikonSDK.dylib
```

It returns `false` when either path is absent. This conservative result avoids
claiming official write-back support based on an assumed SDK layout or an
unverified API.

After the official SDK is installed, inspect headers and samples with:

```bash
rg -n "rating|star|metadata|xmp|protect|attribute" src-tauri/vendor/NikonSDK
```

Record the SDK version, exact rating-related API names, and whether the API
writes a camera-visible 0-5 star rating before changing the probe.

## Fallback behavior

Until an official rating write-back API is confirmed, `set_photo_rating` must
return unsupported through the existing Nikon SDK adapter path. The frontend
rollback behavior remains active, so an optimistic rating change is reverted
when write-back is unavailable.
