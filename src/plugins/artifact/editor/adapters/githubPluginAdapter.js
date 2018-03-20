// @flow

import React from "react";
import type {Node as ReactNode} from "react";

import type {Graph, Node} from "../../../../core/graph";
import type {
  NodePayload,
  NodeID,
  EdgeID,
  NodeType,
  IssueNodePayload,
  PullRequestNodePayload,
  CommentNodePayload,
  AuthorNodePayload,
} from "../../../github/githubPlugin";
import type {PluginAdapter} from "../pluginAdapter";
import {GITHUB_PLUGIN_NAME} from "../../../github/githubPlugin";

const adapter: PluginAdapter<NodePayload> = {
  pluginName: GITHUB_PLUGIN_NAME,

  extractType(graph: *, node: Node<NodePayload>): NodeType {
    const id: NodeID = JSON.parse(node.address.id);
    return id.type;
  },

  extractTitle(graph: *, node: Node<NodePayload>): string {
    const polynode: Node<any> = node;
    const type: NodeType = this.extractType(graph, node);
    switch (type) {
      case "ISSUE":
        return (polynode: Node<IssueNodePayload>).payload.title;
      case "PULL_REQUEST":
        return (polynode: Node<PullRequestNodePayload>).payload.title;
      case "COMMENT": {
        const parentNames: string[] = graph
          .getInEdges(node.address)
          .filter((e) => {
            const edgeID: EdgeID = JSON.parse(e.address.id);
            return edgeID.type === "CONTAINMENT";
          })
          .map((e) => graph.getNode(e.src))
          .map((container) => {
            if (this.extractType(graph, container) === "COMMENT") {
              // Should never happen...
              return "<cycle>";
            } else {
              return JSON.stringify(this.extractTitle(graph, container));
            }
          });
        if (parentNames.length === 0) {
          return "comment (orphaned)";
        } else {
          // Should just be one parent.
          return `comment on ${parentNames.join(" and ")}`;
        }
      }
      case "USER":
      case "ORGANIZATION":
      case "BOT":
        return (polynode: Node<AuthorNodePayload>).payload.login;
      default:
        throw new Error(`unexpected node type: ${type}`);
    }
  },

  render(graph: *, node: Node<NodePayload>): ReactNode {
    return <div>hi</div>;
  },
};

export default adapter;
