import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import { LAB_DIRECTIONS, labEnabled } from "@/lib/lab";
import { LabClip } from "./_kit/lab-clip";
import "./lab.css";

const shot = (file: string) => `/lab/shots/${file}`;

function Shots({ slug, name }: { slug: string; name: string }) {
  return (
    <>
      <figure>
        <a href={shot(`${slug}-1440.png`)}>
          <Image
            className="still"
            src={shot(`${slug}-1440.png`)}
            alt={`${name}: the first screen at 1440 by 810`}
            width={1440}
            height={810}
            unoptimized
          />
        </a>
        <figcaption>First screen, 1440×810</figcaption>
      </figure>
      <figure className="phone">
        <a href={shot(`${slug}-390-full.png`)}>
          <Image
            className="still"
            src={shot(`${slug}-390.png`)}
            alt={`${name}: the first screen on a phone, 390 wide`}
            width={390}
            height={844}
            unoptimized
          />
        </a>
        <figcaption>390 wide (tap for the full page)</figcaption>
      </figure>
      <figure>
        <LabClip
          slug={slug}
          label={`${name}: the agent building the lineup after Watch`}
        />
        <figcaption>
          The build after Watch, from the real replay of the saved build
        </figcaption>
      </figure>
    </>
  );
}

/** The design round's contact sheet: every direction's stills, clip and sentence on one page. */
export default function LabPage() {
  if (!labEnabled()) notFound();
  return (
    <main className="lab-index">
      <header className="intro">
        <h1>Design round: six directions for the first screen</h1>
        <p className="lede">
          Each direction is drawn from one thing in the music world and runs on
          the saved Boise build. The words are the live ones: the first
          sentence, the plain words, each act&apos;s venue and climb, and Watch
          how it picked these acts as the first click. Pick one or two and say
          why.
        </p>
        <p className="small">
          Your words on the live design are C1 to C4 in docs/design-bans.md.
          Each clip replays the saved build through the app (no new Qloo or
          Claude calls); on this machine the replay waits about 4 seconds on the
          cache before its first step, which the clip skips. Open a direction to
          press Watch yourself.
        </p>
      </header>

      {LAB_DIRECTIONS.map((direction, index) => (
        <section
          key={direction.slug}
          className="direction"
          aria-labelledby={`d-${direction.slug}`}
        >
          <div>
            <p className="count">
              Direction {index + 1} of {LAB_DIRECTIONS.length}
            </p>
            <h2 id={`d-${direction.slug}`}>{direction.name}</h2>
            <p className="reference">{direction.reference}</p>
            <p className="why">{direction.why}</p>
            <p className="links">
              <Link href={`/lab/${direction.slug}`}>
                Open it and press Watch
              </Link>
            </p>
          </div>
          <Shots slug={direction.slug} name={direction.name} />
        </section>
      ))}

      <section className="direction current" aria-labelledby="d-live">
        <div>
          <p className="count">For comparison</p>
          <h2 id="d-live">The live design</h2>
          <p className="reference">
            The letterpress show bill, as main had it on 18 October (c5927c7)
          </p>
          <p className="links">
            <Link href="/">Open it</Link>
          </p>
        </div>
        <Shots slug="live" name="The live design" />
      </section>
    </main>
  );
}
