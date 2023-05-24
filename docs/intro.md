#  Web 变身桌面 APP：断网也能用

> 随着 Web 和 Native 之间的界限日益模糊，Web 能够完成的任务越来越多。得益于service worker，Web现在甚至可以在第二次访问时实现离线使用。然而，对于首次访问的离线使用，这依然是个挑战。本文将探讨如何利用Electron技术将Web转变为桌面应用，从而实现首次访问时的离线使用。

##  效果

为了达到这样的效果，我们需要提前缓存页面的静态资源和GET接口请求。

##  应用场景

- APP中原生页面与H5页面的无缝切换：例如，对聊天窗口中的特定域名URL进行预离线缓存，点击时即可直接打开，无需等待加载（类似Telegram的Instant View功能）；
- 提升Web使用体验：简单地为Web应用套上一个APP壳并不能真正提升体验，关键在于实现APP应该具有的无等待、无加载、无闪烁的体验；
  - 阅读/工具类应用：例如组件使用文档，无网络情况下也可以打开阅读；
  - 单页面应用：由于多路径复用的都是相同的静态文件，离线使用更易实现。
- APP的动态化：除了预先打包进安装包的静态文件，APP还可以通过URL增量扩展应用，实现APP在灵活性和体验之间的平衡。

...

##  预备知识

1. electron
2. http server  
3. 基本概念：electron session/protocol/main process/renderer process/ipc/preload

electron 应用符合 C/S 架构，与 Web 应用的对应关系如下：

main -> preload -> renderer
server -> ipc sdk -> client
server -> http sdk -> client

无论 electron 应用多么复杂，都是由这三部分组成。

##  实现思路

1. 使用私有协议：
   1. 定义 electron  `protocol`，将 `https` 协议转换为 `app` 协议 
   2. 将所有的 get 请求 redirect 到 `app` 协议
   3. 在 `app` 协议中，先从缓存中读取，如果没有再通过 `https` 请求数据 

2. 使用 session.setProxy:
   1. 启动 http server，作为代理服务器
   2. 通过 setProxy 将所有的请求转发到 http server
   3. http server 对 get 请求进行缓存/读本地文件，post 请求直接转发

3. 使用 http server:
   1. 启动 http server，作为代理服务器
   2. 通过 beforeHeaderSend 将所有的 get 请求 redirect 到 http server
   3. http server 对 get 请求进行缓存/读本地文件
