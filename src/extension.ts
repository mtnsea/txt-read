import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { contributes } from "../package.json";

const CONFIGNAME = contributes.configuration.title;

export function activate(context: vscode.ExtensionContext) {
  /** TxT-Read 面板 */
  const txtReaderPanelProvider = new TxtReaderPanelProvider(context.extensionUri);

  // 重启
  context.subscriptions.push(
    vscode.commands.registerCommand("txt-read.restart", () => {
      txtReaderPanelProvider.getBook();
    })
  );
  // 监听配置文件变化
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration((event) => {
      // 路径修改
      if (event.affectsConfiguration("TXT-Read.filePath")) {
        txtReaderPanelProvider.getBook();
      }
      // 页码修改
      if (event.affectsConfiguration("TXT-Read.pageNumber")) {
        txtReaderPanelProvider.getBook();
      }
      // 字数修改
      if (event.affectsConfiguration("TXT-Read.pageSize")) {
        txtReaderPanelProvider.getBook();
      }
    })
  );
  // 注册面板
  context.subscriptions.push(vscode.window.registerWebviewViewProvider("TxtRead_Panel_Read", txtReaderPanelProvider));
}

export function deactivate() {
  console.log("TXT-READ deactivate");
}

class Config {
  constructor() {}

  getConfig<T>(key: string): any {
    return vscode.workspace.getConfiguration(CONFIGNAME).get<T>(key);
  }

  setConfig(key: string, value: any) {
    vscode.workspace
      .getConfiguration(CONFIGNAME)
      .update(key, value, vscode.ConfigurationTarget.Global)
      .then(() => {
        console.log("工作区配置已更新");
      });
  }
}

class TxtReaderPanelProvider extends Config implements vscode.WebviewViewProvider {
  private _webviewView?: vscode.WebviewView;
  private initialMessage?: any; // 用于保存待发送的初始消息

  private _pageSize: number;
  private _filePath: string;
  private _pageNumber: number;

  constructor(private readonly _extensionUri: vscode.Uri) {
    super();
    this._pageSize = this.getConfig<number>("pageSize") || 1000;
    this._filePath = this.getConfig<string>("filePath") || "";
    this._pageNumber = this.getConfig<number>("pageNumber") || 1;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._webviewView = webviewView;
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    // 读取打包后的 html 文件
    const indexPath = path.join(this._extensionUri.fsPath, "dist", "webviews", "panel.html");
    const htmlContent = fs.readFileSync(indexPath, "utf-8");

    // 替换资源路径为 Webview 可用的 URI
    webviewView.webview.html = this.replaceResources(webviewView.webview, htmlContent);

    webviewView.webview.postMessage({
      command: "init",
      message: "ok",
    });

    if (this.initialMessage) {
      webviewView.webview.postMessage(this.initialMessage);
      this.initialMessage = undefined;
    }

    // 监听来自 Webview 的消息
    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "fromVue_mounted":
          this.getBook();
          break;
        case "fromVue_nextPage": // 下一页
          this.nextPage();
          break;
        case "fromVue_previousPage":
          this.previousPage();
          break;
      }
    });
  }

  private replaceResources(webview: vscode.Webview, htmlContent: string): string {
    return htmlContent.replace(/(src|href)="(.+?)"/g, (match, p1, p2) => {
      const resourcePath = vscode.Uri.joinPath(this._extensionUri, "dist", "webviews", p2);
      return `${p1}="${webview.asWebviewUri(resourcePath)}"`;
    });
  }

  // 主动触发 postMessage 的方法
  sendMessageToWebview(message: any) {
    // 存在就直接触发
    if (this._webviewView) {
      this._webviewView.webview.postMessage(message);
    } else {
      // 不存在就存一下
      this.initialMessage = message;
    }
  }

  /**
   * 获取文件或目录
   * @param filePath 文件或目录的绝对路径
   */
  private _getFileOrFiles(filePath: string) {
    // 检查路径是否存在
    if (!fs.existsSync(filePath)) return vscode.window.showErrorMessage(`路径不存在: ${filePath}`);

    if (fs.lstatSync(filePath).isFile()) {
      // 文件
      this._handleFile(filePath);
    } else {
      // 目录
      // todo 多文件处理，类似书架功能
      return vscode.window.showErrorMessage(`不是TXT文件的绝对路径`);
    }
  }

  /**
   * 处理文件
   * @param filePath 文件的绝对路径
   */
  private _handleFile(filePath: string) {
    if (filePath.endsWith(".txt")) {
      const content = fs.readFileSync(filePath, "utf-8");
      const fileName = path.basename(filePath);

      const pageNumber = this._pageNumber;
      const chunks = this.addParagraphTags(content);

      const page = pageNumber - 1 >= 0 ? pageNumber - 1 : 0;

      if (chunks.length < page) {
        this.setConfig("pageNumber", 1);
        return;
      }

      this.sendMessageToWebview({
        command: "send",
        message: {
          title: fileName,
          text: chunks[page],
          total: chunks.length,
          pageNumber: pageNumber,
        },
      });
    } else {
      vscode.window.showWarningMessage("文件类型非'TXT'类型");
    }
  }

  /**
   * 添加段落标签
   * 
   * 将给定的字符串分割成多个部分，并为每个部分添加指定的段落标签
   *
   * @param str 待处理的字符串
   * @param sp 分隔符，默认为 '\r\n'，用于分割字符串
   * @param tag 段落标签，默认为 'p'，将被添加到每个分割后的部分
   * @returns 返回一个字符串数组，每个元素都是包含段落标签的字符串
   */
  private addParagraphTags(str: string, sp: string = "\r\n", tag: string = "p"): string[] {
    const num = this._pageSize;
    const parts = str.split(sp);
    let resultParts: string[] = [];
    for (let i = 0; i < parts.length; i += num) {
      const batch = parts.slice(i, i + num);
      const taggedBatch = batch.map((part) => {
        return `<${tag}>${part}</${tag}>`
      });
      const mergedPart = taggedBatch.join("");
      resultParts.push(mergedPart);
    }
    return resultParts;
  }

  getBook() {
    this._pageSize = this.getConfig<number>("pageSize") || 1000;
    this._filePath = this.getConfig<string>("filePath") || "";
    this._pageNumber = this.getConfig<number>("pageNumber") || 1;
    if (typeof this._filePath === "string" && this._filePath.replace(/\s/g, "").length > 0) {
      this._getFileOrFiles(this._filePath);
    } else {
      vscode.window.showWarningMessage("请先配置TXT-Read.filePath");
    }
  }

  private pageNumberChange(pageNumber: number) {}

  private nextPage() {
    const pageNumber = this.getConfig<number>("pageNumber") || 0;
    this.setConfig("pageNumber", pageNumber + 1);
  }

  private previousPage() {
    const pageNumber = this.getConfig<number>("pageNumber") || 0;
    this.setConfig("pageNumber", pageNumber - 1);
  }
}
