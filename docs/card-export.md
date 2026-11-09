# PNG card exports

Open an available free card, complete its required fields and choose **Generate
PNG**. When rendering succeeds, **Download Card** saves a 1500 × 2000 PNG. No
account or payment is needed for local generation. Changing personalization hides
and revokes the previous file so it cannot be downloaded with stale words.

The renderer draws the same self-contained SVG used by the preview into a fixed
production-size canvas, then encodes a PNG with `toBlob`. It never screenshots
browser UI or scales a thumbnail. All twelve known designs have a 600 × 800 logical
canvas (3:4 portrait). Unknown designs or incompatible saved canvas dimensions
are rejected rather than stretched or replaced. Text wraps and reduces font size
within its assigned region; unusually long text may become small. Animated designs
use the deterministic unanimated artwork in PNG. Preview and export share system
font stacks, so font appearance can vary between operating systems.

Only supported fields appear in the image, including name, age where used,
message, sender, and the design's original artwork. Private photos have a prepared `photo-keepsake` renderer and authenticated upload
pipeline; remote rollout is pending. See [private user files](user-file-storage.md).
AI images remain unsupported. Other snapshot layouts requiring additional
assets are rejected. Custom templates require their own compatible
renderer before export. Private upload rollout is documented separately; AI
integration remains unimplemented.

Private saved generation snapshots come from the existing owner-restricted RPC.
Supported free snapshots can render locally using their saved design key and
personalization, without fetching current catalogue values. Failed jobs are not
exported. This browser operation does not write generated records, upload files,
or mark processing server jobs completed. The trusted worker/storage completion
contract in [generation API](generation-api.md) remains in effect. Saved designs
use the app's current renderer for their key; versioned renderer code is not yet
archived with snapshots.

Download names use only the public design title, normalized to a bounded ASCII
slug plus `.png`. They exclude recipient names, messages, account identities and
record IDs. The PNG contains the intentional visible personalization but no added
private metadata. PNG files stay in browser memory until downloaded. Object URLs
are revoked after edits, regeneration and page exit.

Implementation uses standard [canvas PNG encoding](https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toBlob)
and [drawing vector images](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Using_images).
