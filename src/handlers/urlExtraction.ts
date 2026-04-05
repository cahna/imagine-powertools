/**
 * URL and ID extraction utilities.
 * Extracts UUIDs from page URLs, images, and video elements.
 */

import { logger } from "../shared/logger";
import { URL_PATTERNS } from "../config";

/** Extracts the post ID from the current URL path (e.g., /imagine/post/{id}). */
export function getPostId(): string | null {
  const pathname = window.location.pathname;
  const match = pathname.match(/^\/imagine\/post\/([^/]+)/);
  return match ? match[1] : null;
}

/**
 * Extracts the source image/video UUID from the page.
 * Checks images first (for image-to-video posts), then falls back to video src
 * (for single-video posts without carousel).
 */
export function getSourceImageId(): string | null {
  const uuidPattern = URL_PATTERNS.uuid;

  const images = document.querySelectorAll<HTMLImageElement>("img");

  // First pass: look for direct source image URL (non-CDN)
  for (const img of images) {
    const src = img.src || "";

    // Direct source image URL pattern (no cdn-cgi in path)
    if (
      src.includes("imagine-public.x.ai/imagine-public/images/") &&
      !src.includes("cdn-cgi")
    ) {
      const match = src.match(/imagine-public\/images\/([0-9a-f-]+)\.jpg/i);
      if (match && match[1] && uuidPattern.test(match[1])) {
        return match[1];
      }
    }
  }

  // Second pass: fallback to CDN images if no direct URL found
  for (const img of images) {
    const src = img.src || "";

    if (src.includes("imagine-public/images/")) {
      const match = src.match(/imagine-public\/images\/([0-9a-f-]+)\.jpg/i);
      if (match && match[1] && uuidPattern.test(match[1])) {
        return match[1];
      }
    }
  }

  // Third pass: check alt attributes as last resort
  for (const img of images) {
    const src = img.src || "";
    const alt = img.alt || "";

    if (uuidPattern.test(alt) && src.includes("imagine-public")) {
      return alt;
    }
  }

  // Fourth pass: extract from video src or poster (for single-video posts without carousel)
  const videos = document.querySelectorAll<HTMLVideoElement>("video");
  for (const video of videos) {
    // Check video src: share-videos/{uuid}.mp4
    const src = video.src || "";
    const shareMatch = src.match(/share-videos\/([0-9a-f-]+)\.mp4/i);
    if (shareMatch && shareMatch[1] && uuidPattern.test(shareMatch[1])) {
      return shareMatch[1];
    }
    // Check for generated video pattern
    const generatedMatch = src.match(
      /generated\/([0-9a-f-]+)\/generated_video\.mp4/i,
    );
    if (
      generatedMatch &&
      generatedMatch[1] &&
      uuidPattern.test(generatedMatch[1])
    ) {
      return generatedMatch[1];
    }
    // Check video poster: share-videos/{uuid}_thumbnail.jpg
    const poster = video.poster || "";
    const posterMatch = poster.match(/share-videos\/([0-9a-f-]+)_thumbnail/i);
    if (posterMatch && posterMatch[1] && uuidPattern.test(posterMatch[1])) {
      return posterMatch[1];
    }
  }

  return null;
}

/** Extracts the image/video UUID from a masonry card element's img/video src or alt. */
export function getImageIdFromCard(card: Element): string | null {
  const uuidPattern = URL_PATTERNS.uuid;

  // First, check for video element (videos have UUID in different URL pattern)
  const video = card.querySelector<HTMLVideoElement>("video");
  if (video?.src) {
    // Pattern: assets.grok.com/users/.../generated/{uuid}/generated_video.mp4
    const videoMatch = video.src.match(
      /generated\/([0-9a-f-]+)\/generated_video\.mp4/i,
    );
    if (videoMatch && videoMatch[1] && uuidPattern.test(videoMatch[1])) {
      return videoMatch[1];
    }
    // Pattern: imagine-public.x.ai/imagine-public/share-videos/{uuid}.mp4
    const shareMatch = video.src.match(/share-videos\/([0-9a-f-]+)\.mp4/i);
    if (shareMatch && shareMatch[1] && uuidPattern.test(shareMatch[1])) {
      return shareMatch[1];
    }
  }

  // Look for an image within the card
  const img = card.querySelector<HTMLImageElement>("img");
  if (img) {
    // Check src first for URL-based patterns
    if (img.src) {
      logger.log("Checking img src:", img.src);
      // Pattern: imagine-public/images/{uuid}.jpg (standard images)
      const imgMatch = img.src.match(
        /imagine-public\/images\/([0-9a-f-]+)\.jpg/i,
      );
      logger.log("imgMatch result:", imgMatch);
      if (imgMatch && imgMatch[1] && uuidPattern.test(imgMatch[1])) {
        return imgMatch[1];
      }
      // Pattern: assets.grok.com/users/.../generated/{uuid}/preview_image.jpg (video thumbnails)
      const previewMatch = img.src.match(
        /generated\/([0-9a-f-]+)\/preview_image\.jpg/i,
      );
      if (
        previewMatch &&
        previewMatch[1] &&
        uuidPattern.test(previewMatch[1])
      ) {
        return previewMatch[1];
      }
      // Pattern: imagine-public.x.ai/imagine-public/share-videos/{uuid}_thumbnail.jpg
      const shareVideoThumbMatch = img.src.match(
        /share-videos\/([0-9a-f-]+)_thumbnail\.jpg/i,
      );
      if (
        shareVideoThumbMatch &&
        shareVideoThumbMatch[1] &&
        uuidPattern.test(shareVideoThumbMatch[1])
      ) {
        return shareVideoThumbMatch[1];
      }
    }

    // Fallback: check alt attribute (used on results page where src is base64)
    if (img.alt && uuidPattern.test(img.alt)) {
      return img.alt;
    }
  }

  return null;
}

/** Traverses up the DOM to find the masonry card container from a click target. */
export function findMasonryCard(target: Element): Element | null {
  // Look for the card container - it has the class containing "media-post-masonry-card"
  let current: Element | null = target;
  while (current) {
    if (current.classList?.toString().includes("media-post-masonry-card")) {
      return current;
    }
    // Also check for role="listitem" which is the outer container
    if (current.getAttribute?.("role") === "listitem") {
      const card = current.querySelector('[class*="media-post-masonry-card"]');
      if (card) return card;
    }
    current = current.parentElement;
  }
  return null;
}
