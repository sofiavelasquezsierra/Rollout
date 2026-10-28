/** Narrated walkthrough, hosted on Loom. */
const LOOM_ID = "5a678e054fdc40c8b184e6be007db0e3";

export function Walkthrough() {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-md border border-line bg-bg">
      <iframe
        src={`https://www.loom.com/embed/${LOOM_ID}?hide_owner=true&hide_share=true&hide_title=true&hideEmbedTopBar=true`}
        title="Rollout walkthrough"
        allow="autoplay; fullscreen; picture-in-picture"
        allowFullScreen
        className="absolute inset-0 size-full"
      />
    </div>
  );
}
