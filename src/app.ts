import { PropsWithChildren } from 'react';
import './app.scss';

// 移动端调试工具
if (process.env.TARO_ENV === 'h5') {
  import('vconsole').then(({ default: VConsole }) => {
    new VConsole();
  });
}

function App({ children }: PropsWithChildren) {
  return children;
}

export default App;
