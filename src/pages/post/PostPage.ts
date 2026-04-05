import { PageObject } from "../PageObject";
import { GenerationStatusPage } from "../GenerationStatusPage";
import { ToolbarPage } from "./ToolbarPage";
import { PromptFormPage } from "./PromptFormPage";
import { VideoCarouselPage } from "./VideoCarouselPage";

/**
 * Composite PageObject providing structured access to all post page components.
 * This is a facade - no orchestration logic, just component composition.
 */
export class PostPage extends PageObject {
  readonly carousel: VideoCarouselPage;
  readonly toolbar: ToolbarPage;
  readonly promptForm: PromptFormPage;
  readonly generationStatus: GenerationStatusPage;

  constructor(doc: Document = document) {
    super(doc);
    this.carousel = new VideoCarouselPage(doc);
    this.toolbar = new ToolbarPage(doc);
    this.promptForm = new PromptFormPage(doc);
    this.generationStatus = new GenerationStatusPage(doc);
  }

  /** Returns true if we're on a post page. */
  isPresent(): boolean {
    return window.location.pathname.startsWith("/imagine/post/");
  }

  /** Returns the current post ID from the URL. */
  getPostId(): string | null {
    const match = window.location.pathname.match(/^\/imagine\/post\/([^/]+)/);
    return match ? match[1] : null;
  }
}
