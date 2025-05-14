declare module 'qrcode-terminal' {
  const qrcodeTerminal: {
    generate: (text: string, options?: { small?: boolean }) => void
  };
  export default qrcodeTerminal;
} 