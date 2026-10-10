/** Microsoft’s unmodified stable VS Code icon: https://code.visualstudio.com/brand */
export function ExtensionButton() {
  return (
    <a href="https://marketplace.visualstudio.com/items?itemName=SakethSripada.perpetual-for-vscode"
      className="inline-flex h-12 items-center gap-2.5 rounded-full px-5 text-[15px] font-medium text-white/85 ring-1 ring-white/25 transition-colors hover:bg-white/[0.08] hover:text-white">
      <img src={`${import.meta.env.BASE_URL}vscode.png`} alt="" width={20} height={20} />
      Download VS Code extension
    </a>
  );
}
