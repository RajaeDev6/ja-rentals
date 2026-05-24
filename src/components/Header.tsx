export function Header() {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 bg-blue-700 rounded flex items-center justify-center">
            <span className="text-white text-xs font-bold">JA</span>
          </div>
          <span className="font-semibold text-gray-900 text-sm sm:text-base">JA Rentals</span>
        </div>
        <span className="text-xs text-gray-500 hidden sm:block">
          Fresh listings — last 30 days only
        </span>
      </div>
    </header>
  );
}
