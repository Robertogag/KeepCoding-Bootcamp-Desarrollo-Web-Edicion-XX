const mediaTriggers = document.querySelectorAll("[data-media-trigger]");
const detailsTrailer = document.querySelector("#details-trailer");
const detailsTitle = document.querySelector("#details-title");
const detailsMeta = document.querySelector("#details-meta");
const detailsSynopsis = document.querySelector("#details-synopsis");
const detailsCredits = document.querySelector("#details-credits");
const detailsFact = document.querySelector("#details-fact");
const detailsYoutubeLink = document.querySelector("#details-youtube-link");

function createEmbedUrl(youtubeId, autoplay = false) {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1"
  });

  if (autoplay) {
    params.set("autoplay", "1");
    params.set("mute", "1");
  }

  return `https://www.youtube-nocookie.com/embed/${youtubeId}?${params.toString()}`;
}

function updateSpotlight(trigger, autoplay = false) {
  if (!trigger || !detailsTitle || !detailsMeta || !detailsSynopsis) {
    return;
  }

  const { title } = trigger.dataset;
  const mediaData = window.MEDIA_LIBRARY?.[title];

  if (!mediaData) {
    return;
  }

  detailsTitle.textContent = title;
  detailsMeta.textContent = mediaData.meta;
  detailsSynopsis.textContent = mediaData.synopsis;

  if (detailsCredits) {
    detailsCredits.textContent = mediaData.credits;
  }

  if (detailsFact) {
    detailsFact.textContent = mediaData.fact;
  }

  if (mediaData.youtubeId && detailsTrailer) {
    detailsTrailer.src = createEmbedUrl(mediaData.youtubeId, autoplay);
    detailsTrailer.title = `${title} trailer`;
  }

  if (mediaData.youtubeUrl && detailsYoutubeLink) {
    detailsYoutubeLink.href = mediaData.youtubeUrl;
  }

  mediaTriggers.forEach((item) => item.classList.remove("is-active"));
  trigger.classList.add("is-active");
}

mediaTriggers.forEach((trigger) => {
  trigger.addEventListener("click", () => {
    updateSpotlight(trigger, true);
  });
});

const defaultTrigger = document.querySelector("[data-media-trigger].is-active") || mediaTriggers[0];
updateSpotlight(defaultTrigger, false);
