# Graph View

The Graph View is one of the core features of GoLangGraph Studio, providing a visual representation of your agent's execution flow in real-time.

![Graph View Interface](https://raw.githubusercontent.com/UnicoLab/GoLangGraphStudio/main/public/imgs/graph_view.png)

## Overview

The Graph View displays your GoLangGraph execution as an interactive flowchart, allowing you to:

- **Visualize the execution flow** in real-time
- **Monitor node states** and transitions
- **Debug execution paths** step by step
- **Inspect node data** and state changes
- **Control execution** with play, pause, and step controls

## Interface Components

### 1. Graph Canvas

The main canvas displays your graph with nodes and edges:

- **Nodes**: Represent individual steps in your agent's execution
- **Edges**: Show the flow between nodes
- **Execution Path**: Highlighted path showing current execution
- **Node States**: Color-coded to indicate status (idle, running, completed, error)

### 2. Control Panel

Located at the top of the interface:

- **Play/Pause**: Start or pause execution
- **Step**: Execute one step at a time
- **Stop**: Halt execution completely
- **Reset**: Reset to initial state
- **Fit to Screen**: Auto-zoom to fit the entire graph

### 3. State Inspector

On the right side panel:

- **Current State**: Shows the current graph state
- **Node Details**: Detailed information about selected nodes
- **Execution Context**: Runtime variables and metadata

### 4. Live Logs Panel

Bottom panel showing real-time execution logs:

- **Execution Logs**: Timestamped log entries
- **Log Filtering**: Filter by log level (info, debug, error, warning)
- **Log Search**: Search through execution history

## Node Types and States

### Node Types

| Type | Description | Color |
|------|-------------|-------|
| **Start** | Entry point of the graph | Green |
| **Process** | Processing or computation node | Blue |
| **Decision** | Conditional branching node | Orange |
| **Tool** | External tool or function call | Purple |
| **End** | Terminal node | Red |

### Node States

| State | Description | Indicator |
|-------|-------------|-----------|
| **Idle** | Not yet executed | Gray border |
| **Running** | Currently executing | Pulsing blue border |
| **Completed** | Successfully completed | Green fill |
| **Error** | Execution failed | Red fill |
| **Paused** | Execution paused at this node | Yellow border |

## Interactive Features

### Node Interaction

**Click a node** to:
- View detailed node information
- Inspect input/output data
- Set breakpoints for debugging
- View execution history

**Right-click a node** to:
- Set/remove breakpoints
- Jump to node in execution
- Copy node information
- View node logs

### Execution Controls

**Real-time Execution**
- Watch nodes light up as they execute
- See data flow between nodes
- Monitor execution timing

**Step-by-Step Debugging**
- Pause at any node
- Inspect state before proceeding
- Step through execution manually

**Breakpoints**
- Set breakpoints on any node
- Conditional breakpoints based on state
- Automatic pause at breakpoints

### Zoom and Navigation

**Mouse Controls**
- **Scroll**: Zoom in/out
- **Drag**: Pan the canvas
- **Double-click**: Focus on node

**Keyboard Shortcuts**
- `Space`: Play/Pause execution
- `S`: Step execution
- `R`: Reset execution
- `F`: Fit to screen
- `+/-`: Zoom in/out

## Advanced Features

### State Management

**Dynamic State Updates**
- View state changes in real-time
- Inspect variable values
- Track state history

**State Editing**
- Modify state during execution
- Inject test data
- Reset specific variables

### Performance Monitoring

**Execution Metrics**
- Node execution times
- Memory usage tracking
- Performance bottlenecks
- Execution statistics

### Graph Layout

**Auto-Layout**
- Automatic node positioning
- Hierarchical layout
- Force-directed layout
- Custom positioning

**Manual Layout**
- Drag nodes to reposition
- Save custom layouts
- Multiple layout presets

## Best Practices

### Debugging Workflow

1. **Start with Overview**: Get familiar with the graph structure
2. **Set Strategic Breakpoints**: Place breakpoints at decision points
3. **Monitor State Changes**: Watch how data flows through nodes
4. **Analyze Performance**: Identify slow or problematic nodes
5. **Iterate and Refine**: Use insights to improve your graph

### Performance Tips

- **Use Breakpoints Sparingly**: Too many can slow down execution
- **Filter Logs**: Reduce noise by filtering to relevant log levels
- **Monitor Memory**: Watch for memory leaks in long-running graphs
- **Optimize Layout**: Arrange nodes logically for easier debugging

## Troubleshooting

### Common Issues

**Graph Not Displaying**
: Check that your GoLangGraph server is running and the graph endpoint is accessible.

**Nodes Not Updating**
: Verify WebSocket connection is active. Check network tab for connection issues.

**Slow Performance**
: Reduce log verbosity and close unnecessary panels to improve performance.

**Layout Issues**
: Use the "Fit to Screen" button or manually adjust zoom level.

### Debug Mode Integration

The Graph View complements Studio's Debug view:

- **Synchronized State**: State changes reflect in both views
- **Cross-Navigation**: Click logs to highlight nodes
- **Unified Controls**: Execution controls work across views

## Related Features

- Debug view - Detailed execution analysis
- Chat view - Conversational interface
- Agent selection in the Studio header - Configure agents
