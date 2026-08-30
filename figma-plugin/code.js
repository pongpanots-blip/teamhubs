figma.showUI(__html__, { width: 340, height: 420 });

function currentSelectionContext() {
  const page = figma.currentPage;
  const selection = page.selection;
  const frame = selection.length > 0 ? selection[0] : null;

  return {
    fileName: figma.root.name,
    fileKey: figma.fileKey || null,
    pageName: page.name,
    frameName: frame ? frame.name : null,
    nodeId: frame ? frame.id : null,
  };
}

function postContext() {
  figma.ui.postMessage({ type: "context", context: currentSelectionContext() });
}

figma.on("selectionchange", postContext);
figma.on("currentpagechange", postContext);

figma.clientStorage.getAsync("teamhub-settings").then((settings) => {
  figma.ui.postMessage({ type: "settings", settings: settings || {} });
  postContext();
});

figma.ui.onmessage = async (msg) => {
  if (msg.type === "save-settings") {
    await figma.clientStorage.setAsync("teamhub-settings", msg.settings);
    return;
  }
  if (msg.type === "get-context") {
    postContext();
    return;
  }
  if (msg.type === "notify") {
    figma.notify(msg.message, { error: Boolean(msg.error) });
    return;
  }
  if (msg.type === "close") {
    figma.closePlugin();
  }
};
