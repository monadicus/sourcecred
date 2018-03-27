import type {Address} from "../../core/address";
import {Graph, edgeID} from "../../core/graph";
const stringify = require("json-stable-stringify");

export const GITHUB_PLUGIN_NAME = "sourcecred/github-beta";

/** Node Types */
export const ISSUE_NODE_TYPE = "ISSUE";
export type IssueNodePayload = {|
  +title: string,
  +number: number,
  +body: string,
|};

export const PULL_REQUEST_NODE_TYPE = "PULL_REQUEST";
export type PullRequestNodePayload = {|
  +title: string,
  +number: number,
  +body: string,
|};

export type PullRequestReviewState =
  | "CHANGES_REQUESTED"
  | "APPROVED"
  | "COMMENTED"
  | "DISMISSED"
  | "PENDING";
export const PULL_REQUEST_REVIEW_NODE_TYPE = "PULL_REQUEST_REVIEW";
export type PullRequestReviewNodePayload = {|
  +body: string,
  +state: PullRequestReviewState,
|};

export const COMMENT_NODE_TYPE = "COMMENT";
export type CommentNodePayload = {|
  +url: string,
  +body: string,
|};

// We have this as a separate type from regular comments because we may
// be interested in diff hunks, which are only present on PR review
// comments.
export const PULL_REQUEST_REVIEW_COMMENT_NODE_TYPE =
  "PULL_REQUEST_REVIEW_COMMENT";
export type PullRequestReviewCommentNodePayload = {|
  +url: string,
  +body: string,
|};

export const USER_NODE_TYPE = "USER";
export type UserNodePayload = {|
  +login: string,
|};

export const BOT_NODE_TYPE = "BOT";
export type BotNodePayload = {|
  +login: string,
|};

export const ORGANIZATION_NODE_TYPE = "ORGANIZATION";
export type OrganizationNodePayload = {|
  +login: string,
|};

export type AuthorNodePayload =
  | UserNodePayload
  | BotNodePayload
  | OrganizationNodePayload;

export type NodePayload =
  | IssueNodePayload
  | PullRequestNodePayload
  | CommentNodePayload
  | PullRequestReviewCommentNodePayload
  | PullRequestReviewNodePayload
  | AuthorNodePayload;

/** Edge Types */
export type EdgePayload =
  | AuthorshipEdgePayload
  | ContainmentEdgePayload
  | ReferenceEdgePayload;

export class GithubParser {
  repositoryName: string;
  graph: Graph<NodePayload, EdgePayload>;

  constructor(repositoryName: string) {
    this.repositoryName = repositoryName;
    this.graph = new Graph();
  }

  makeNodeAddress(type: string, id: string): Address {
    return {
      pluginName: GITHUB_PLUGIN_NAME,
      repositoryName: this.repositoryName,
      type,
      id,
    };
  }

  makeEdgeAddress(type: string, src: Address, dst: Address): Address {
    return {
      pluginName: GITHUB_PLUGIN_NAME,
      repositoryName: this.repositoryName,
      type,
      id: edgeID(src, dst),
    };
  }

  addAuthorship(
    authoredNode: Node<
      | IssueNodePayload
      | PullRequestNodePayload
      | CommentNodePayload
      | PullRequestReviewCommentNodePayload
      | PullRequestReviewNodePayload
    >,
    authorJson: *
  ) {
    let authorPayload: AuthorNodePayload = {login: authorJson.login};
    let authorType: string;
    switch (authorJson.__typename) {
      case "User":
        authorType = "USER";
        break;
      case "Bot":
        authorType = "BOT";
        break;
      case "Organization":
        authorType = "ORGANIZATION";
        break;
      default:
        throw new Error(
          `Unexpected author type ${authorJson.__typename} on ${stringify(
            authorJson
          )}`
        );
    }

    const authorNode: Node<AuthorNodePayload> = {
      address: this.makeNodeAddress(authorType, authorJson.id),
      payload: authorPayload,
    };
    this.graph.addNode(authorNode);

    const authorshipEdge: Edge<AuthorshipEdgePayload> = {
      address: this.makeEdgeAddress(
        "AUTHORSHIP",
        authoredNode.address,
        authorNode.address
      ),
      payload: {},
      src: authoredNode.address,
      dst: authorNode.address,
    };
    this.graph.addEdge(authorshipEdge);
  }

  addComment(
    parentNode: Node<
      IssueNodePayload | PullRequestNodePayload | PullRequestReviewNodePayload
    >,
    commentJson: *
  ) {
    let commentType: string;
    switch (parentNode.address.type) {
      case "PULL_REQUEST_REVIEW":
        commentType = "PULL_REQUEST_REVIEW_COMMENT";
        break;
      case "PULL_REQUEST":
      case "ISSUE":
        commentType = "COMMENT";
        break;
      default:
        throw new Error(
          `Unexpected comment parent type ${parentNode.address.type}`
        );
    }

    const commentNodePayload:
      | CommentNodePayload
      | PullRequestReviewCommentNodePayload = {
      body: commentJson.body,
      url: commentJson.url,
    };
    const commentNode: Node<
      CommentNodePayload | PullRequestReviewCommentNodePayload
    > = {
      address: this.makeNodeAddress(commentType, commentJson.id),
      payload: commentNodePayload,
    };
    this.graph.addNode(commentNode);

    this.addAuthorship(commentNode, commentJson.author);
    this.addContainment(parentNode, commentNode);
  }

  addContainment(
    parentNode: Node<
      IssueNodePayload | PullRequestNodePayload | PullRequestReviewNodePayload
    >,
    childNode: Node<
      | CommentNodePayload
      | PullRequestReviewCommentNodePayload
      | PullRequestReviewNodePayload
    >
  ) {
    const containmentEdge = {
      address: this.makeEdgeAddress(
        "CONTAINMENT",
        parentNode.address,
        childNode.address
      ),
      payload: {},
      src: parentNode.address,
      dst: childNode.address,
    };
    this.graph.addEdge(containmentEdge);
  }

  addIssue(issueJson: *) {
    const issuePayload: IssueNodePayload = {
      number: issueJson.number,
      title: issueJson.title,
      body: issueJson.body,
    };
    const issueNode: Node<IssueNodePayload> = {
      address: this.makeNodeAddress("ISSUE", issueJson.id),
      payload: issuePayload,
    };
    this.graph.addNode(issueNode);

    this.addAuthorship(issueNode, issueJson.author);

    issueJson.comments.nodes.forEach((c) => this.addComment(issueNode, c));
  }

  addPullRequest(prJson: *) {
    const pullRequestPayload: PullRequestNodePayload = {
      number: prJson.number,
      title: prJson.title,
      body: prJson.body,
    };
    const pullRequestNode: Node<PullRequestNodePayload> = {
      address: this.makeNodeAddress("PULL_REQUEST", prJson.id),
      payload: pullRequestPayload,
    };
    this.graph.addNode(pullRequestNode);

    this.addAuthorship(pullRequestNode, prJson.author);
    prJson.comments.nodes.forEach((c) => this.addComment(pullRequestNode, c));

    prJson.reviews.nodes.forEach((r) =>
      this.addPullRequestReview(pullRequestNode, r)
    );
  }

  addPullRequestReview(
    pullRequestNode: Node<PullRequestNodePayload>,
    reviewJson: *
  ) {
    const reviewPayload: PullRequestReviewNodePayload = {
      state: reviewJson.state,
      body: reviewJson.body,
    };
    const reviewNode: Node<PullRequestReviewNodePayload> = {
      address: this.makeNodeAddress("PULL_REQUEST_REVIEW", reviewJson.id),
      payload: reviewPayload,
    };
    this.graph.addNode(reviewNode);
    this.addContainment(pullRequestNode, reviewNode);
    this.addAuthorship(reviewNode, reviewJson.author);
    reviewJson.comments.nodes.forEach((c) => this.addComment(reviewNode, c));
  }

  addData(dataJson: *) {
    dataJson.repository.issues.nodes.forEach((i) => this.addIssue(i));
    dataJson.repository.pullRequests.nodes.forEach((pr) =>
      this.addPullRequest(pr)
    );
  }
}
