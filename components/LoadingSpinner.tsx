export default function LoadingSpinner() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="relative w-12 h-12">
        <div className="absolute inset-0 border-4 border-muted border-t-primary rounded-full animate-spin" />
      </div>
    </div>
  )
}
