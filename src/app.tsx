import * as React from "react";
import { StartClient } from "@tanstack/react-start";
import { getRouter } from "./router";

export default function App() {
  return <StartClient router={getRouter()} />;
}
