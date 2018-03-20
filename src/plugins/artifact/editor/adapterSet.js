// @flow

import type {Graph, Node} from "../../../core/graph";
import type {PluginAdapter} from "./pluginAdapter";

export class AdapterSet {
  adapters: {[pluginName: string]: PluginAdapter<any>};

  constructor() {
    this.adapters = {};
  }

  addAdapter(adapter: PluginAdapter<any>): void {
    this.adapters[adapter.pluginName] = adapter;
  }

  getAdapter<NP>(node: Node<NP>): PluginAdapter<NP> | null {
    return this.adapters[node.address.pluginName];
  }
}
