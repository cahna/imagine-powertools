/**
 * Alt+Shift+Click handler for opening images/videos in new background tabs.
 * Works on favorites and results pages.
 */

import { logger } from "../shared/logger";
import { ContentMessageType } from "../shared/messageTypes";
import { getCurrentMode } from "./navigation";
import { getImageIdFromCard, findMasonryCard } from "./urlExtraction";

/** Sets up Alt+Shift+Click handler to open images/videos in new background tabs. */
export function setupFavoritesClickHandler(): void {
  document.addEventListener(
    "click",
    async (e) => {
      // Skip synthetic clicks we dispatch for navigation interception
      if (
        (e as MouseEvent & { _syntheticForInterception?: boolean })
          ._syntheticForInterception
      ) {
        return;
      }

      // Only handle Alt+Shift+Click
      if (!e.altKey || !e.shiftKey) {
        return;
      }

      const currentMode = getCurrentMode();

      // Only in favorites or results mode (both show image/video grids)
      if (currentMode !== "favorites" && currentMode !== "results") {
        return;
      }

      const target = e.target as Element;
      logger.log("Alt+Shift+Click on:", target.tagName, target.className);
      const card = findMasonryCard(target);

      if (!card) {
        logger.log("No card found for target");
        return;
      }
      logger.log("Found card:", card.className);

      // Prevent default click behavior
      e.preventDefault();
      e.stopPropagation();

      // Try direct DOM extraction first (works for favorites and cached images)
      let imageId = getImageIdFromCard(card);
      logger.log("getImageIdFromCard result:", imageId);

      // Fallback: simulate click and capture navigation URL (for fresh result images)
      if (!imageId) {
        logger.log("Attempting navigation capture fallback");
        const scrollY = window.scrollY;
        const originalUrl = window.location.href;

        // Create synthetic click without modifiers
        const syntheticClick = new MouseEvent("click", {
          bubbles: true,
          cancelable: true,
          view: window,
        }) as MouseEvent & { _syntheticForInterception?: boolean };
        syntheticClick._syntheticForInterception = true;

        // Dispatch on the image or card
        const clickTarget = card.querySelector("img") || card;
        logger.log("Dispatching synthetic click on:", clickTarget.tagName);
        clickTarget.dispatchEvent(syntheticClick);

        // Poll for URL change (React navigation is async)
        for (let i = 0; i < 20; i++) {
          await new Promise((resolve) => setTimeout(resolve, 50));

          if (window.location.href !== originalUrl) {
            logger.log("URL changed to:", window.location.href);
            const match = window.location.pathname.match(
              /\/imagine\/post\/([^/?]+)/,
            );
            if (match) {
              imageId = match[1];
              // Go back to results page
              history.back();
              // Restore scroll position after navigation
              await new Promise((resolve) => setTimeout(resolve, 50));
              window.scrollTo(0, scrollY);
            }
            break;
          }
        }

        if (!imageId) {
          logger.log("URL did not change after synthetic click");
        }
      }

      if (imageId) {
        const url = `https://grok.com/imagine/post/${imageId}`;
        chrome.runtime.sendMessage({ type: ContentMessageType.OPEN_TAB, url });
      } else {
        logger.log("Could not extract image/video ID from card");
      }
    },
    true,
  ); // Use capture phase to intercept before React handlers
}
