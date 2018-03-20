// @flow

import type {Graph, Node} from "../../../core/graph";
import type {Node as ReactNode} from "react";

export interface PluginAdapter<-NodePayload> {
  pluginName: string;
  extractType(graph: Graph<any, any>, node: Node<NodePayload>): string;
  extractTitle(graph: Graph<any, any>, node: Node<NodePayload>): string;
  render(graph: Graph<any, any>, node: Node<NodePayload>): ReactNode;
}
