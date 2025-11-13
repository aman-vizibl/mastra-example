PROBLEM:

### Message duplication

In the agent tool `delegate-to-fruit-agent` where we wrap the fruit agent with shared memory from supervisor agent, having access to the same thread results in sub agent writing messages to the thread resulting in duplicated messages within the thread.

### Sub agent calls supervisor agent tool

Although hard to reproduce in this particular case, in case of more complex workflows the sub agent seems to call supervisor agent tool especially during HITL loops state handovers between the agents. Even though delegateToFruitAgent is only given to supervisor agent.