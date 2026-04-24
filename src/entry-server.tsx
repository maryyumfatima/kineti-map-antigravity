import { createStartHandler, defaultStreamHandler } from "@tanstack/react-start/server";
import { getRouter } from "./router";

export default createStartHandler({
  createRouter: getRouter,
  getRouterManifest: () => import.meta.env.MANIFEST,
})(defaultStreamHandler);
