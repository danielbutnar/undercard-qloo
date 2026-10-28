/**
 * A Qloo call's parameters in plain words (WS13.9), for the full Qloo calls list beside their raw
 * form: the signals, the filters, the popularity range. Only what the app sent, never what Qloo
 * answered. A parameter it doesn't know keeps its raw form.
 */

type Param = { key: string; value: string };

const ENTITY: Record<string, string> = {
  "urn:entity:artist": "artists",
  "urn:entity:place": "places",
};

const entity = (urn: string) => ENTITY[urn] ?? urn;

/** "0.8" on Qloo's 0–1 scale as the site's 0–100: "80". */
const hundredths = (value: string) => {
  const number = Number(value);
  return Number.isFinite(number) ? String(Math.round(number * 100)) : value;
};

/** "25_to_29,30_to_34" as "25 to 34"; a bucket it can't read keeps its raw form. */
function ages(value: string): string {
  const spans = value.split(",").map((bucket) => {
    const span = /^(\d+)_to_(\d+)$/.exec(bucket);
    if (span) return [Number(span[1]), Number(span[2])] as const;
    const under = /^(\d+)_and_younger$/.exec(bucket);
    if (under) return [0, Number(under[1])] as const;
    const over = /^(\d+)_and_older$/.exec(bucket);
    if (over) return [Number(over[1]), Infinity] as const;
    return null;
  });
  if (spans.some((span) => span === null)) return value;
  const low = Math.min(...spans.map((span) => span![0]));
  const high = Math.max(...spans.map((span) => span![1]));
  if (low === 0) return `${high} and younger`;
  if (high === Infinity) return `${low} and older`;
  return `${low} to ${high}`;
}

/** "urn:tag:genre:place:live_music_venue" as "live music venue". */
const tagWords = (value: string) =>
  value
    .split(",")
    .map((tag) => tag.slice(tag.lastIndexOf(":") + 1).replace(/_/g, " "))
    .join(", ");

export function paramWords(params: readonly Param[]): string[] {
  const value = (key: string) =>
    params.find((param) => param.key === key)?.value;
  const lines: string[] = [];
  for (const { key, value: raw } of params) {
    switch (key) {
      case "filter.type":
        lines.push(
          raw === "urn:entity:place" ? "Lists places" : `Ranks ${entity(raw)}`,
        );
        break;
      case "signal.interests.entities":
        lines.push(`Signal: fans of ${raw}`);
        break;
      case "a.signal.interests.entities":
        lines.push(`Compares fans of ${raw}`);
        break;
      case "b.signal.interests.entities":
        lines.push(`with fans of ${raw}`);
        break;
      case "signal.location.query":
        lines.push(`Location signal: ${raw}`);
        break;
      case "signal.demographics.age":
        lines.push(`Crowd's age: ${ages(raw)}`);
        break;
      case "filter.popularity.min": {
        const max = value("filter.popularity.max");
        lines.push(
          max === undefined
            ? `Popularity from ${hundredths(raw)} on Qloo's 0–100 scale`
            : `Popularity ${hundredths(raw)} to ${hundredths(max)} on Qloo's 0–100 scale`,
        );
        break;
      }
      case "filter.popularity.max":
        if (value("filter.popularity.min") === undefined)
          lines.push(
            `Popularity up to ${hundredths(raw)} on Qloo's 0–100 scale`,
          );
        break;
      case "filter.exclude.entities":
        lines.push(`Leaves out: ${raw}`);
        break;
      case "filter.results.entities":
        lines.push(`Only these acts: ${raw}`);
        break;
      case "filter.location.query":
        lines.push(`In: ${raw}`);
        break;
      case "filter.tags":
        lines.push(`Tagged: ${tagWords(raw)}`);
        break;
      case "filter.query":
        lines.push(`Tags matching "${raw}"`);
        break;
      case "filter.parents.types":
        lines.push(`For: ${entity(raw)}`);
        break;
      case "query":
        lines.push(`Name: "${raw}"`);
        break;
      case "types":
        lines.push(`Among: ${entity(raw)}`);
        break;
      case "feature.explainability":
        lines.push("With Qloo's split of each act's match");
        break;
      case "take":
        lines.push(`Top ${raw}`);
        break;
      default:
        lines.push(`${key}: ${raw}`);
    }
  }
  return lines;
}
