/**
 * POLIS Governance Behavior Tree Compositor
 *
 * Executes a BTNodeConfig tree using the same pattern as SAR Engine v2:
 *   - Sequence: run children in order; fail if any child fails
 *   - Selector: run children until one succeeds
 *   - Parallel: run all children concurrently; configurable fail policy
 *   - Leaf: delegates to SARLeafNode.tick()
 *
 * Based on sar-engine/src/v2/core/bt-compositor.ts patterns.
 */

import {
  BTStatus,
  type BTNodeConfig,
  type BTResult,
  type SARNodeContext,
  type BTEvent,
  type SARLeafNode,
} from "./types";

export class GovernanceBTCompositor {
  private errors: Array<{ nodeId: string; error: string }> = [];

  /**
   * Execute the full behavior tree against a governance context.
   * Returns BTResult with synthesized analysis if successful.
   */
  async execute(tree: BTNodeConfig, context: SARNodeContext): Promise<BTResult> {
    const startMs = Date.now();
    this.errors = [];

    context.emit(this.makeEvent("bt:tree_start", "compositor", context, {
      task: context.task,
      refId: context.refId,
    }));

    const status = await this.runNode(tree, context);

    const durationMs = Date.now() - startMs;

    context.emit(this.makeEvent("bt:tree_end", "compositor", context, {
      status,
      durationMs,
      errors: this.errors.length,
    }));

    return {
      status,
      durationMs,
      analysis: context.memory.synthesizedAnalysis,
      errors: this.errors,
    };
  }

  /**
   * Dispatch a node config to the appropriate executor.
   */
  private async runNode(node: BTNodeConfig, context: SARNodeContext): Promise<BTStatus> {
    switch (node.type) {
      case "sequence": return this.runSequence(node, context);
      case "selector": return this.runSelector(node, context);
      case "parallel": return this.runParallel(node, context);
      case "leaf":     return this.runLeaf(node.node, context);
    }
  }

  /**
   * Sequence: run children in order.
   * Returns FAILURE immediately if any child fails.
   * Returns SUCCESS only if ALL children succeed.
   */
  private async runSequence(
    node: Extract<BTNodeConfig, { type: "sequence" }>,
    context: SARNodeContext
  ): Promise<BTStatus> {
    context.emit(this.makeEvent("bt:sequence_start", node.label ?? "sequence", context));

    for (const child of node.children) {
      const status = await this.runNode(child, context);
      if (status === BTStatus.FAILURE) {
        context.emit(this.makeEvent("bt:sequence_fail", node.label ?? "sequence", context));
        return BTStatus.FAILURE;
      }
      if (status === BTStatus.RUNNING) {
        return BTStatus.RUNNING;
      }
    }

    context.emit(this.makeEvent("bt:sequence_success", node.label ?? "sequence", context));
    return BTStatus.SUCCESS;
  }

  /**
   * Selector: run children in order until one succeeds.
   * Returns SUCCESS as soon as any child succeeds.
   * Returns FAILURE only if ALL children fail.
   */
  private async runSelector(
    node: Extract<BTNodeConfig, { type: "selector" }>,
    context: SARNodeContext
  ): Promise<BTStatus> {
    context.emit(this.makeEvent("bt:selector_start", node.label ?? "selector", context));

    for (const child of node.children) {
      const status = await this.runNode(child, context);
      if (status === BTStatus.SUCCESS) {
        context.emit(this.makeEvent("bt:selector_success", node.label ?? "selector", context));
        return BTStatus.SUCCESS;
      }
    }

    context.emit(this.makeEvent("bt:selector_fail", node.label ?? "selector", context));
    return BTStatus.FAILURE;
  }

  /**
   * Parallel: run all children concurrently.
   * failFast=true (default): fail immediately if any child fails
   * failFast=false: run all, succeed if ALL succeed
   */
  private async runParallel(
    node: Extract<BTNodeConfig, { type: "parallel" }>,
    context: SARNodeContext
  ): Promise<BTStatus> {
    const failFast = node.failFast !== false;
    context.emit(this.makeEvent("bt:parallel_start", node.label ?? "parallel", context, {
      childCount: node.children.length,
      failFast,
    }));

    const results = await Promise.allSettled(
      node.children.map(child => this.runNode(child, context))
    );

    let anyFailure = false;
    for (const result of results) {
      if (result.status === "rejected") {
        anyFailure = true;
        this.errors.push({ nodeId: "parallel-child", error: String(result.reason) });
      } else if (result.value === BTStatus.FAILURE) {
        anyFailure = true;
      }
    }

    if (anyFailure && failFast) {
      context.emit(this.makeEvent("bt:parallel_fail", node.label ?? "parallel", context));
      return BTStatus.FAILURE;
    }

    context.emit(this.makeEvent("bt:parallel_success", node.label ?? "parallel", context));
    return BTStatus.SUCCESS;
  }

  /**
   * Leaf: execute the actual work node.
   */
  private async runLeaf(node: SARLeafNode, context: SARNodeContext): Promise<BTStatus> {
    const start = Date.now();

    context.emit(this.makeEvent(`bt:node_start`, node.id, context, {
      label: node.label,
    }));

    try {
      const status = await node.tick(context);
      const ms = Date.now() - start;

      context.emit(this.makeEvent(`bt:node_end`, node.id, context, {
        status,
        durationMs: ms,
      }));

      return status;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.errors.push({ nodeId: node.id, error: msg });

      context.emit(this.makeEvent(`bt:node_error`, node.id, context, {
        error: msg,
      }));

      return BTStatus.FAILURE;
    }
  }

  private makeEvent(
    type: string,
    source: string,
    context: SARNodeContext,
    payload?: Record<string, unknown>
  ): BTEvent {
    return {
      type,
      source,
      orgId: context.orgId,
      refId: context.refId,
      payload,
      timestamp: new Date().toISOString(),
    };
  }
}
