import * as twgl from "twgl.js";
import {
  CanvasRenderer,
  UpdateFunction,
  createCanvasRenderer,
} from "./rendering/WebGLRenderer";

//@ts-ignore
import EFFECT_FRAG from "./EffectGL.frag";
//@ts-ignore
import EFFECT_VERT from "./EffectGL.vert";
import {
  virtualScrollState,
  virtualScrollItems,
  Plane,
} from "./useVirtualScroll";
import { proxy, subscribe } from "valtio";

let planesBufferInfo: twgl.BufferInfo[] = [];

export function createWebGLScroll(
  canvas: HTMLCanvasElement,
  content: HTMLDivElement
) {
  const init = createInitFunction({ contentElm: content });
  const { gl, cleanup } = createCanvasRenderer({
    canvas,
    init,
    update,
  });

  const updatePlanesBuffer = () => {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    function mapToNDCTopLeft(
      plane: Plane,
      screenWidth: number,
      screenHeight: number
    ) {
      const { x, y, width, height } = plane;

      // Convert the top-left corner to centered NDC coordinates
      const ndcX = (x / screenWidth) * 2 - 1;
      const ndcY = 1 - (y / screenHeight) * 2;

      const ndcWidth = (width / screenWidth) * 2;

      const ndcHeight = (height / screenHeight) * 2;

      return {
        ndcX,
        ndcY,
        ndcWidth,
        ndcHeight,
      };
    }

    planesBufferInfo = Object.values(virtualScrollItems).map((plane, index) => {
      const { ndcX, ndcY, ndcWidth, ndcHeight } = mapToNDCTopLeft(
        plane,
        windowWidth,
        windowHeight
      );

      // console.log(plane);
      const leftEdge = ndcX;
      const rightEdge = ndcX + ndcWidth;
      const topEdge = ndcY;
      const bottomEdge = ndcY - ndcHeight;

      // const width = plane.width / windowWidth;
      // const height = plane.width / windowHeight;

      const arr = {
        a_position: [
          leftEdge,
          topEdge,
          0,
          rightEdge,
          topEdge,
          0,
          leftEdge,
          bottomEdge,
          0,
          leftEdge,
          bottomEdge,
          0,
          rightEdge,
          topEdge,
          0,
          rightEdge,
          bottomEdge,
          0,
        ],
      };

      // if (index % 2 === 1) {
      return twgl.createBufferInfoFromArrays(gl, arr);
      // }
      // console.log(arr);
      // return twgl.createBufferInfoFromArrays(gl, { a_position: [0, 0, 0] });
    });
  };

  const unsubscribeScrollItems = subscribe(
    virtualScrollItems,
    updatePlanesBuffer
  );
  updatePlanesBuffer(); // first render

  return () => {
    unsubscribeScrollItems();
    cleanup();
  };
}

// ================================================================
// init function
// ================================================================
const createInitFunction = ({ contentElm }: { contentElm: HTMLDivElement }) => {
  // retrun a create function so that the user can inject params here
  return async ({ gl, canvas }: CanvasRenderer) => {
    // init webgl
    const program = twgl.createProgramFromSources(gl, [
      EFFECT_VERT,
      EFFECT_FRAG,
    ]);
    const programInfo = twgl.createProgramInfoFromProgram(gl, program);

    return { programInfo, contentElm };
  };
};

// ================================================================
// update function
// ================================================================
const update: UpdateFunction<ReturnType<typeof createInitFunction>> = (
  renderer,
  frame,
  programState
) => {
  const { gl, canvas } = renderer;
  const { elapsed, delta } = frame;
  const { programInfo, contentElm } = programState;

  gl.viewport(0, 0, canvas.width, canvas.height);

  const uniforms = {
    u_resolution: [canvas.width, canvas.height],
    u_delta: delta,
    u_time: elapsed,
    u_scroll: virtualScrollState.current,
  };

  gl.useProgram(programInfo.program);

  const allBuffers = planesBufferInfo;
  for (let i = 0; i < allBuffers.length; i++) {
    twgl.setBuffersAndAttributes(gl, programInfo, allBuffers[i]);
    twgl.setUniforms(programInfo, uniforms);
    twgl.drawBufferInfo(gl, allBuffers[i]);
  }

  if (contentElm)
    contentElm.style.transform = `translateY(${virtualScrollState.current}px)`;
};
