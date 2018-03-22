// @flow

import deepEqual from "lodash.isequal";
import type {Address, Addressable, AddressMapJSON} from "./address";
import {AddressMap} from "./address";

export type Node<T: string, +P> = {|
  +address: Address<T>,
  +payload: P,
|};

export type Edge<T: string, +P> = {|
  +address: Address<T>,
  // At a type level, we do not guarantee that the src/dst of edges in the graph
  // have the same type as nodes and edges that are actually in the graph.
  // You can derive that this is appropriate from the fact that we do not
  // guarantee that the src/dst Addresses are present in this graph.
  +src: Address<string>,
  +dst: Address<string>,
  +payload: P,
|};

export type GraphJSON<NT: string, NP, ET: string, EP> = {|
  +nodes: AddressMapJSON<Node<NT, NP>>,
  +edges: AddressMapJSON<Edge<ET, EP>>,
|};

export class Graph<NT: string, NP, ET: string, EP> {
  _nodes: AddressMap<NT, Node<NT, NP>>;
  _edges: AddressMap<ET, Edge<ET, EP>>;

  // The keyset of each of the following fields should equal the keyset
  // of `_nodes`. If `e` is an edge from `u` to `v`, then `e.address`
  // should appear exactly once in `_outEdges[u.address]` and exactly
  // once in `_inEdges[v.address]` (and every entry in `_inEdges` and
  // `_outEdges` should be of this form).
  _outEdges: AddressMap<{|+address: Address<NT>, +edges: Address<ET>[]|}>;
  _inEdges: AddressMap<{|+address: Address<NT>, +edges: Address<ET>[]|}>;

  constructor() {
    this._nodes = new AddressMap();
    this._edges = new AddressMap();
    this._outEdges = new AddressMap();
    this._inEdges = new AddressMap();
  }

  equals(that: Graph<NT, NP, ET, EP>): boolean {
    return this._nodes.equals(that._nodes) && this._edges.equals(that._edges);
  }

  toJSON(): GraphJSON<NT, NP, ET, EP> {
    return {
      nodes: this._nodes.toJSON(),
      edges: this._edges.toJSON(),
    };
  }

  static fromJSON<NT, NP, ET, EP>(
    json: GraphJSON<NT, NP, ET, EP>
  ): Graph<NT, NP, ET, EP> {
    const result = new Graph();
    AddressMap.fromJSON(json.nodes)
      .getAll()
      .forEach((node) => {
        result.addNode(node);
      });
    AddressMap.fromJSON(json.edges)
      .getAll()
      .forEach((edge) => {
        result.addEdge(edge);
      });
    return result;
  }

  addNode(node: Node<NT, NP>): Graph<NT, NP, ET, EP> {
    if (node == null) {
      throw new Error(`node is ${String(node)}`);
    }
    const existingNode = this.getNode(node.address);
    if (existingNode !== undefined) {
      if (deepEqual(existingNode, node)) {
        return this;
      } else {
        throw new Error(
          `node at address ${JSON.stringify(
            node.address
          )} exists with distinct contents`
        );
      }
    }
    this._nodes.add(node);
    this._outEdges.add({address: node.address, edges: []});
    this._inEdges.add({address: node.address, edges: []});
    return this;
  }

  addEdge(edge: Edge<ET, EP>): Graph<NT, NP, ET, EP> {
    if (edge == null) {
      throw new Error(`edge is ${String(edge)}`);
    }
    const existingEdge = this.getEdge(edge.address);
    if (existingEdge !== undefined) {
      if (deepEqual(existingEdge, edge)) {
        return this;
      } else {
        throw new Error(
          `edge at address ${JSON.stringify(
            edge.address
          )} exists with distinct contents`
        );
      }
    }
    if (this.getNode(edge.src) === undefined) {
      throw new Error(`source ${JSON.stringify(edge.src)} does not exist`);
    }
    if (this.getNode(edge.dst) === undefined) {
      throw new Error(`source ${JSON.stringify(edge.dst)} does not exist`);
    }
    this._edges.add(edge);
    this._outEdges.get(edge.src).edges.push(edge.address);
    this._inEdges.get(edge.dst).edges.push(edge.address);
    return this;
  }

  getNode(address: Address<NT>): Node<NT, NP> {
    return this._nodes.get(address);
  }

  getEdge(address: Address<ET>): Edge<ET, EP> {
    return this._edges.get(address);
  }

  /**
   * Gets the array of all out-edges from the node at the given address.
   * The order of the resulting array is unspecified.
   */
  getOutEdges(nodeAddress: Address<NT>): Edge<ET, EP>[] {
    if (nodeAddress == null) {
      throw new Error(`address is ${String(nodeAddress)}`);
    }
    const result = this._outEdges.get(nodeAddress);
    if (result === undefined) {
      throw new Error(`no node for address ${JSON.stringify(nodeAddress)}`);
    }
    return result.edges.map((e) => this.getEdge(e));
  }

  /**
   * Gets the array of all in-edges to the node at the given address.
   * The order of the resulting array is unspecified.
   */
  getInEdges(nodeAddress: Address<NT>): Edge<ET, EP>[] {
    if (nodeAddress == null) {
      throw new Error(`address is ${String(nodeAddress)}`);
    }
    const result = this._inEdges.get(nodeAddress);
    if (result === undefined) {
      throw new Error(`no node for address ${JSON.stringify(nodeAddress)}`);
    }
    return result.edges.map((e) => this.getEdge(e));
  }

  /**
   * Gets all nodes in the graph, in unspecified order.
   */
  getAllNodes(): Node<NT, NP>[] {
    return this._nodes.getAll();
  }

  /**
   * Gets all edges in the graph, in unspecified order.
   */
  getAllEdges(): Edge<ET, EP>[] {
    return this._edges.getAll();
  }

  /**
   * Merge two graphs. When two nodes have the same address, a resolver
   * function will be called with the two nodes; the resolver should
   * return a new node with the same address, which will take the place
   * of the two nodes in the new graph. Edges have similar behavior.
   *
   * The existing graph objects are not modified.
   */
  static merge<NP1, EP1, NP2, EP2>(
    g1: Graph<any, NP1, any, EP1>,
    g2: Graph<any, NP2, any, EP2>,
    nodeResolver: (Node<any, NP1>, Node<any, NP2>) => Node<any, NP1 | NP2>,
    edgeResolver: (Edge<any, EP1>, Edge<any, EP2>) => Edge<any, EP1 | EP2>
  ): Graph<any, NP1 | NP2, any, EP1 | EP2> {
    const result: Graph<any, NP1 | NP, any, EP1 | EP2> = new Graph();
    g1.getAllNodes().forEach((node) => {
      if (g2.getNode(node.address) !== undefined) {
        const resolved = nodeResolver(node, g2.getNode(node.address));
        result.addNode(resolved);
      } else {
        result.addNode(node);
      }
    });
    g2.getAllNodes().forEach((node) => {
      if (result.getNode(node.address) === undefined) {
        result.addNode(node);
      }
    });
    g1.getAllEdges().forEach((edge) => {
      if (g2.getEdge(edge.address) !== undefined) {
        const resolved = edgeResolver(edge, g2.getEdge(edge.address));
        result.addEdge(resolved);
      } else {
        result.addEdge(edge);
      }
    });
    g2.getAllEdges().forEach((edge) => {
      if (result.getEdge(edge.address) === undefined) {
        result.addEdge(edge);
      }
    });
    return result;
  }

  /**
   * Merge two graphs, assuming that if `g1` and `g2` both have a node
   * with a given address, then the nodes are deep-equal (and the same
   * for edges). If this assumption does not hold, this function will
   * raise an error.
   */
  static mergeConservative<NP1, EP1, NP2, EP2>(
    g1: Graph<any, NP1, any, EP1>,
    g2: Graph<any, NP2, any, EP2>
  ): Graph<any, NP1 | NP, any, EP1 | EP2> {
    function conservativeResolver<T: Addressable<string>>(
      kinds: string /* used for an error message on mismatch */,
      a: T,
      b: T
    ): T {
      if (deepEqual(a, b)) {
        return a;
      } else {
        throw new Error(
          `distinct ${kinds} with address ${JSON.stringify(a.address)}`
        );
      }
    }
    const result: Graph<any, NP1 | NP2, any, EP1 | EP2> = Graph.merge(
      g1,
      g2,
      (u, v) => conservativeResolver("nodes", u, v),
      (e, f) => conservativeResolver("edges", e, f)
    );
    return result;
  }
}
