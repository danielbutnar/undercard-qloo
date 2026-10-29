/**
 * The about line at the foot of every page (WS12 item 10): what Undercard was built for, whose
 * data it reads, which model plans for it, and where the AI usage is written up. The model comes
 * from src/server/ai.ts by way of the root layout, so this stays a plain component.
 */

/** A model's id as people read it: "claude-sonnet-5-5" is "Claude Sonnet 5.5". */
export function modelName(id: string): string {
  const words = id.split("-");
  const numbers: string[] = [];
  while (words.length > 0 && /^\d+$/.test(words.at(-1)!))
    numbers.unshift(words.pop()!);
  const name = words
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return numbers.length > 0 ? `${name} ${numbers.join(".")}` : name;
}

export function SiteFooter({ model }: { model: string }) {
  // An ink band across the foot of the page, as a poster's credits run along its foot.
  return (
    <footer className="bg-ink px-[clamp(16px,3.4vw,56px)] text-surface">
      <p className="mx-auto max-w-[1328px] py-4 text-[13px] leading-snug font-bold">
        Built for the Qloo Agentic Hackathon · taste data from Qloo · the AI
        agent plans with {modelName(model)}{" "}
        <span className="whitespace-nowrap">({model})</span> · how AI was used
        to make Undercard: the README&apos;s AI usage section
      </p>
    </footer>
  );
}
