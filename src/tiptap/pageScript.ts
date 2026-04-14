/**
 * Page script for tiptap content setting.
 * Runs in the page's main world (not isolated content script).
 * Communicates with content script via window.postMessage.
 *
 * This script is ALWAYS injected to support tiptap content setting.
 * It is separate from the intercept pageScript which is opt-in.
 */

(function () {
  const TIPTAP_PREFIX = "IPT_TIPTAP";

  interface TiptapSetContentMessage {
    type: `${typeof TIPTAP_PREFIX}:setContent`;
    id: string;
    text: string;
  }

  interface TiptapSetContentResponse {
    type: `${typeof TIPTAP_PREFIX}:setContentDone`;
    id: string;
    success: boolean;
    editorText?: string;
    domText?: string;
  }

  window.addEventListener("message", (event) => {
    if (event.source !== window) return;
    if (event.data?.type !== `${TIPTAP_PREFIX}:setContent`) return;

    const message = event.data as TiptapSetContentMessage;
    const selector = 'div.tiptap.ProseMirror[contenteditable="true"]';
    const el = document.querySelector(selector) as HTMLElement & {
      editor?: {
        chain(): {
          clearContent(): { insertContent(text: string): { run(): void } };
        };
        getText(): string;
        commands: {
          setContent(content: string, emitUpdate?: boolean): boolean;
        };
      };
    };

    if (!el) {
      console.error("[ImaginePowerTools] Tiptap element not found");
      window.postMessage(
        {
          type: `${TIPTAP_PREFIX}:setContentDone`,
          id: message.id,
          success: false,
        } as TiptapSetContentResponse,
        "*",
      );
      return;
    }

    // Focus first
    el.focus();

    const editor = el.editor;

    // Use editor API to set content. The actual prompt injection into the
    // request happens in the intercept pageScript, which reads from editor.getText().
    if (editor) {
      try {
        editor.commands.setContent(message.text, true);
      } catch (e) {
        editor.chain().clearContent().insertContent(message.text).run();
      }
    } else {
      // Fallback to execCommand
      document.execCommand("selectAll", false, undefined);
      document.execCommand("delete", false, undefined);
      document.execCommand("insertText", false, message.text);
    }

    // Dispatch events
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));

    // Log what we actually set
    const editorText = editor?.getText?.() || "";
    const domText = el.textContent || "";
    console.log("[ImaginePowerTools] Tiptap content set:", {
      requestedText: message.text.substring(0, 50) + "...",
      editorText: editorText.substring(0, 50) + "...",
      domText: domText.substring(0, 50) + "...",
      editorMatch: editorText === message.text,
      domMatch: domText === message.text,
    });

    // Send confirmation back to content script
    window.postMessage(
      {
        type: `${TIPTAP_PREFIX}:setContentDone`,
        id: message.id,
        success: true,
        editorText,
        domText,
      } as TiptapSetContentResponse,
      "*",
    );
  });

  console.log("[ImaginePowerTools] Tiptap content handler active");
})();
