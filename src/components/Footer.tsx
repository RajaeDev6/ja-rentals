export function Footer() {
  return (
    <footer className="border-t border-gray-200 mt-16 py-8 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-400">
        <p>
          &copy; {new Date().getFullYear()} JA Rentals. All listings sourced from third-party
          platforms. Verify details with the listing agent before committing.
        </p>
        <p>Only listings posted within the last 30 days are shown.</p>
      </div>
    </footer>
  );
}
