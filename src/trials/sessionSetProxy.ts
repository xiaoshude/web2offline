import { session, net } from "electron";
import { startProxyServer } from "./proxyServer";
// import { usePrivateAppProtocol } from './privateProtocol';

export async function useSessionForHostV1(host: string) {

  startProxyServer()
  const hostSession = session.defaultSession;

  await session.defaultSession.setProxy({ proxyRules: 'http://localhost:9898' })
    .then(() => {
      console.log('Proxy set successfully');

      // const request = net.request('http://localhost:8080');
      // request.on('response', (response) => {
      //   console.log(`STATUS: ${response.statusCode}`);
      // });
      // request.end();
    });
}
