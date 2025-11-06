export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-row items-stretch bg-background text-foreground">
      <div className="flex w-[10%] items-center justify-center border-2 border-tertiary bg-tertiary/20 m-4 rounded-lg shadow-md">
        <span className="text-center w-full font-semibold">Left<br />10%</span>
      </div>
      <div className="flex w-[65%] items-center justify-center border-2 border-secondary bg-secondary/20 m-4 rounded-lg shadow-md">
        <span className="text-center w-full font-semibold">Center<br />65%</span>
      </div>
      <div className="flex w-[25%] items-center justify-center border-2 border-primary bg-primary/20 m-4 rounded-lg shadow-md">
        <span className="text-center w-full font-semibold">Right<br />25%</span>
      </div>
    </main>
  );
}
