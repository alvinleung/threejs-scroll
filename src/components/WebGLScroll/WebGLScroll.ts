import * as twgl from "twgl.js";

//@ts-ignore
import EFFECT_FRAG from "./shaders/EffectGL.frag";
//@ts-ignore
import EFFECT_VERT from "./shaders/EffectGL.vert";

import { Plane, ScrollItems, ScrollState } from "./VirtualScroll";
import {
  FrameInfo,
  WebGLRenderer,
  WebGLRendererDelegate,
} from "./utils/WebGLRenderer";
import { CleanupProtocol } from "./utils/CleanupProtocol";
import { PlanesUpdater } from "./PlanesUpdater";
import { AnimatedValue } from "./AnimatedValue/AnimatedValue";

interface WebGLScrollConfig {
  canvas: HTMLCanvasElement;
  content: HTMLDivElement;
  items: ScrollItems;
  scroll: AnimatedValue;
}
/**
 * The main entry point of the program
 */
export class WebGLScroll implements WebGLRendererDelegate, CleanupProtocol {
  private contentElm: HTMLDivElement;
  private scroll: AnimatedValue;
  private webGLRenderer: WebGLRenderer;
  private planesUpdater: PlanesUpdater;
  private programInfo: twgl.ProgramInfo | undefined;

  constructor({ content, canvas, items, scroll }: WebGLScrollConfig) {
    this.contentElm = content;
    this.scroll = scroll;

    this.webGLRenderer = new WebGLRenderer(this, canvas);
    this.planesUpdater = new PlanesUpdater({
      items,
      gl: this.webGLRenderer.getWebGLContext(),
    });
  }

  cleanup(): void {
    this.webGLRenderer.cleanup();
    this.planesUpdater.cleanup();
  }

  async onRendererWillInit({ gl, canvas }: FrameInfo) {
    // init webgl
    const program = twgl.createProgramFromSources(gl, [
      EFFECT_VERT,
      EFFECT_FRAG,
    ]);
    this.programInfo = twgl.createProgramInfoFromProgram(gl, program);
  }

  onRender({ gl, canvas, elapsed, delta }: FrameInfo): void {
    // Step 1 - Render webgl on the background canvas
    gl.viewport(0, 0, canvas.width, canvas.height);

    const programInfo = this.programInfo;
    if (!programInfo) throw "Program info not found during render loop.";

    const uniforms = {
      u_resolution: [canvas.width, canvas.height],
      u_delta: delta,
      u_time: elapsed,
      u_scroll: this.scroll.getCurrent(),
    };

    gl.useProgram(programInfo.program);

    // render planes onto the webgl canvas
    const allBuffers = this.planesUpdater.getPlanesBufferInfo();
    for (let i = 0; i < allBuffers.length; i++) {
      twgl.setBuffersAndAttributes(gl, programInfo, allBuffers[i]);
      twgl.setUniforms(programInfo, uniforms);
      twgl.drawBufferInfo(gl, allBuffers[i]);
    }

    // Step 2 - Update DOM scroll offset
    // It is necessary to follow dom update with webgl update in the same
    // requestAnimationFrame call. Or else the position will be out of sync.
    if (this.contentElm)
      this.contentElm.style.transform = `translateY(${this.scroll.getCurrent()}px)`;
  }
}
