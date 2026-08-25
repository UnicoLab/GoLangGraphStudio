# GoLangGraph Studio

<div align="center">
  <img src="../public/imgs/main_screen_ok.png" alt="GoLangGraph Studio Main Interface" width="800"/>
  <p><em>GoLangGraph Studio - A comprehensive development environment for GoLangGraph applications</em></p>
</div>

![React](https://img.shields.io/badge/React-18.2.0-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5.0.0-blue) ![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-3.3.0-blue) ![GoLangGraph](https://img.shields.io/badge/GoLangGraph-1.0.0-green)

A fully functional React interface for debugging and testing GoLangGraph agents, adapted from the LangGraph Studio interface. This provides a comprehensive development environment for GoLangGraph applications without any limits for production use.

## 🚀 Key Features

### 🔗 Interactive Graph View
<div align="center">
  <img src="../public/imgs/graph_view.png" alt="Graph View Interface" width="600"/>
  <p><em>Visual representation of your GoLangGraph execution flow</em></p>
</div>

- **Visual Graph Representation**: Interactive flow diagram showing your GoLangGraph execution
- **Real-time Node Status**: See which nodes are running, completed, or errored
- **Execution Path Tracking**: Visual representation of the current execution path
- **Graph Controls**: Run, step through, or stop graph execution
- **Interactive Nodes**: Click and inspect individual nodes
- **Agent Type Support**: Visualizes Chat, ReAct, and Tool agent types

### 💬 Chat Mode
- **Clean Chat Interface**: Similar to the official LangGraph Studio chat mode
- **Message History**: Persistent conversation threads
- **Markdown Support**: Rich text rendering for assistant responses
- **Typing Indicators**: Real-time feedback during message processing
- **Thread Management**: Create, switch between, and manage multiple chat threads
- **Agent Selection**: Easy switching between different GoLangGraph agents

### 🐛 Debug View
- **State Inspection**: View current graph state and variables
- **Step-by-Step Execution**: Detailed breakdown of each execution step
- **Execution Logs**: Real-time logs with different severity levels
- **Variable Tracking**: Monitor how variables change throughout execution
- **Performance Metrics**: Execution timing and duration tracking
- **WebSocket Streaming**: Real-time updates during execution

### 🎛️ Additional Features
- **Agent Management**: Create and manage multiple GoLangGraph agents
- **Thread Management**: Organize conversations and execution sessions
- **Connection Setup**: Easy configuration for GoLangGraph server connections
- **Responsive Design**: Works on desktop and mobile devices
- **Real-time Updates**: Live updates during graph execution via WebSocket

## 🛠️ Quick Start

### Prerequisites
- Node.js 16+ 
- npm or yarn
- A running GoLangGraph server

### Installation

```bash
# Clone the repository
git clone https://github.com/UnicoLab/GoLangGraphStudio.git
cd GoLangGraphStudio

# Install dependencies
npm install

# Start the development server
npm start
```

Open your browser and navigate to `http://localhost:3000`

## 🔧 Configuration

When you first open the application, you'll see a connection setup screen:

1. **Server URL**: Enter your GoLangGraph server URL (default: `http://localhost:8080`)
2. **Agent ID**: (Optional) Specify a default agent ID
3. **API Key**: (Optional) Your API key for authenticated requests

## 🏗️ Architecture

The interface is built with modern web technologies:

- **React 18**: Modern React with hooks and concurrent features
- **TypeScript**: Type-safe development
- **Zustand**: Lightweight state management
- **Tailwind CSS**: Utility-first CSS framework
- **React Flow**: Interactive graph visualization
- **React Markdown**: Markdown rendering for chat messages

## 🔌 API Integration

The interface is designed to work with the GoLangGraph Server API and supports all GoLangGraph agent types:

- **Chat Agent**: Simple conversational flow
- **ReAct Agent**: Reasoning and Acting pattern with observe loops
- **Tool Agent**: Planning, execution, and review cycle

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

### Development Guidelines

1. **Follow TypeScript best practices**
2. **Use Tailwind CSS for styling**
3. **Write meaningful commit messages**
4. **Add types for new features**
5. **Test your changes thoroughly**

## 📝 License

This project is licensed under the MIT License.

## 🙏 Acknowledgments

- **GoLangGraph Team**: For creating the excellent GoLangGraph framework
- **LangChain Team**: For inspiration from the original LangGraph Studio
- **React Flow**: For the excellent graph visualization library
- **Tailwind CSS**: For the utility-first CSS framework

## 📚 Related Links

- [GoLangGraph Documentation](https://github.com/UnicoLab/GoLangGraph)
- [GoLangGraph GitHub Repository](https://github.com/UnicoLab/GoLangGraph)
- [Original LangGraph Studio](https://langchain-ai.github.io/langgraph/cloud/how-tos/studio/quick_start/)
- [React Flow Documentation](https://reactflow.dev/)

---

**Note**: This is an independent React interface specifically adapted for GoLangGraph. For the official LangGraph Studio, please visit [studio.langchain.com](https://studio.langchain.com/). 