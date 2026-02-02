/**
 * Type declarations for @langchain/langgraph so the IDE resolves the module.
 * Install: pnpm add @langchain/langgraph
 */
declare module "@langchain/langgraph" {
  export const START: unique symbol;
  export const END: unique symbol;

  export const Annotation: {
    Root<T>(def: T): { State: T };
    <T>(): T;
  };

  type GraphState = { message: string; response: string };
  export class StateGraph<State = GraphState> {
    constructor(state: unknown);
    addNode(name: string, fn: (state: GraphState) => Promise<Partial<GraphState>>): this;
    addConditionalEdges(
      from: typeof START | string,
      route: (state: GraphState) => string,
      map: Record<string, string>
    ): this;
    addEdge(from: string, to: typeof END | string): this;
    compile(): { invoke(input: Partial<GraphState>, config?: Record<string, unknown>): Promise<GraphState> };
  }
}
