import { StartClient } from "@tanstack/react-start";
import * as React from "react";
import * as ReactDOM from "react-dom/client";
import { getRouter } from "./router";

const router = getRouter();

ReactDOM.hydrateRoot(
  document,
  <React.StrictMode>
    <StartClient router={router} />
  </React.StrictMode>
);
