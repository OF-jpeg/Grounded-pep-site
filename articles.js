// ══════════════════════════════════════════════════════════════════════
//  GROUNDED — RESEARCH LIBRARY
// ══════════════════════════════════════════════════════════════════════
// Original long-form articles. This is the content that can't be copied
// from a database — synthesis, judgement, and practical guidance.
//
// RULES FOR ADDING CONTENT HERE:
//  - Never invent study findings, statistics, or citations
//  - Never name or recommend specific vendors
//  - Never make medical claims or tell someone what to take
//  - Teach people how to evaluate things themselves
//  - Be honest about uncertainty; say "we don't know" when that's true

const ARTICLES = [
{
  id:'verify-source',
  cat:'Essential',
  catC:'#93C5FD',
  title:'How to Verify a Peptide Source',
  subtitle:'The research chemical market is unregulated. Here is how to evaluate a seller without relying on anyone else\'s word.',
  readTime:'8 min read',
  updated:'August 2026',
  body:`
## Why this is hard

There is no regulator checking that a research peptide vial contains what the label says. No agency verifies purity, dosage accuracy, or sterility. A vendor can print anything on a label and there is no automatic consequence.

That means the burden of verification falls entirely on the buyer. This guide is about doing that properly.

**One thing up front:** Grounded does not recommend, endorse, or affiliate with any vendor. Anyone who tells you there is one trustworthy source is either guessing or selling something. What follows is a framework for judging any seller yourself.

## The certificate of analysis is the whole game

A certificate of analysis (COA) is a lab report on a specific batch of product. It is the single most important document a vendor can provide, and the place where most of the deception happens.

### What a real COA contains

- **The compound name and the batch or lot number** — this must match the number physically printed on the vial you received
- **The testing date** — recent, and after the batch was manufactured
- **The name of the testing laboratory** — an independent third party, not the vendor's own internal lab
- **A purity percentage**, usually from HPLC (high-performance liquid chromatography)
- **Mass spectrometry data** confirming the molecular weight matches the expected compound
- **The actual chromatogram** — the graph, not just a summary number

### The specific ways COAs get faked

**The generic COA.** One report posted on the product page, used for every batch forever. If the lot number on the COA does not match the lot number on your vial, that document tells you nothing about what you actually received.

**The screenshot with no source.** An image of a purity number with no lab letterhead, no chromatogram, no way to verify it came from a lab at all.

**The in-house test.** The vendor tested it themselves. This is not third-party verification, it is a vendor's own claim in a more official-looking font.

**The mismatched compound.** The COA is real, but it is for a different peptide, or a different concentration than what you ordered. This is surprisingly common and easy to miss if you only glance at the purity number.

**The expired report.** A COA from two years ago for a batch that no longer exists.

### How to actually check one

1. Find the lot number on your vial. Find the lot number on the COA. They must match exactly.
2. Look for the testing lab's name. Search that lab. Does it exist? Does it do peptide analysis?
3. Look at the chromatogram. You do not need to be a chemist — you are checking that one exists and that it shows a dominant single peak rather than many comparable peaks.
4. Check the compound name and molecular weight against what you ordered.

If a vendor cannot produce a batch-specific COA on request, that is the end of the evaluation. It does not matter how good the website looks.

## Red flags that should stop a purchase

**Prices far below the market.** Peptide synthesis has real costs. If one vendor is at a third of everyone else's price, the likely explanations are underdosing, low purity, or a different compound entirely. Cheap is a signal, not a bargain.

**Medical claims in the marketing.** Legitimate research suppliers sell for research use. A vendor promising it will "cure" or "treat" anything is either ignorant of the rules they operate under or willing to ignore them — neither inspires confidence about their quality control.

**No physical address or company details.** Not a contact form. An actual registered business identity.

**Payment methods only in crypto or gift cards.** Some legitimate vendors do accept crypto for regulatory reasons, so this alone is not disqualifying — but a seller who accepts *only* irreversible payment methods has removed your ability to dispute anything.

**Pressure tactics.** Countdown timers, "only 3 left," aggressive discount codes. Research suppliers do not need urgency marketing.

**Reviews that all sound the same.** Especially clustered on the same dates, or on the vendor's own site with no independent presence anywhere else.

**No response to technical questions.** Ask about their synthesis process, their testing lab, storage conditions during shipping. A real supplier can answer. A reseller who does not know what they are selling cannot.

## Questions worth asking directly

Send these before ordering. The quality of the answers tells you more than any review.

- Can you provide the COA for the specific lot I would receive?
- Which laboratory performs your testing?
- What purity threshold do you reject a batch at?
- How is the product stored and shipped — is it temperature controlled?
- What is your policy if independent testing shows the product is out of spec?

A vendor who answers these clearly and specifically is operating differently from one who deflects.

## Independent testing

Some people send a sample of what they receive to an independent lab for their own testing. This costs money and takes time, but it is the only way to actually confirm what you have rather than trusting a document.

If you are going to use something over a long period, or at meaningful expense, testing one batch yourself is a reasonable thing to consider.

## The honest limitation of all this

None of this makes an unregulated purchase safe. It reduces the probability of the worst outcomes — receiving something inert, mislabeled, or contaminated — but it does not eliminate them.

The only fully verified supply chain is a prescription pharmaceutical dispensed by a licensed pharmacy. Everything short of that involves accepting some level of unverified risk. This guide is about being clear-eyed about that rather than pretending otherwise.

If you are considering a compound that exists in an approved pharmaceutical form, talking to a doctor about that route is worth doing before deciding the research chemical market is your only option.
`
},
{
  id:'first-peptide',
  cat:'Beginner',
  catC:'#34D399',
  title:'Your First Peptide: Start to Finish',
  subtitle:'What actually happens, in order, from deciding to research something through to your first dose.',
  readTime:'10 min read',
  updated:'August 2026',
  body:`
## Before anything else

Talk to a doctor. Genuinely, not as a disclaimer.

Most people skip this because they assume the answer will be no. Sometimes it is. But a doctor can also tell you that what you are trying to address has an approved treatment you did not know about, or that a compound interacts badly with something you already take, or that your symptoms warrant investigating something else entirely.

Peptides are also not a good first move for most problems. Sleep, training, nutrition, and stress account for the majority of what people are trying to fix with compounds. That is not a platitude — it is the reason a lot of protocols disappoint.

## Step 1 — Be specific about the goal

"Feeling better" is not something you can evaluate. Pick something you can actually observe:

- A specific injury that has not resolved in a defined timeframe
- A measurable marker you have baseline data for
- A specific symptom you could rate week to week

Write down where you are starting. Almost nobody does this, and it is the reason people cannot tell whether anything worked. Memory reconstructs itself around what you expect to have happened.

## Step 2 — Research the compound properly

Read the full profile, not the benefits list. The parts that matter most:

**Research status.** Preclinical means cell cultures and animals. It does not mean the effect will appear in humans — most preclinical findings do not translate. Human trial data is a fundamentally different level of evidence.

**Half-life.** This determines dosing frequency. A compound with a 30-minute half-life and one lasting a week are used completely differently.

**Side effects.** Read these before the benefits. If any of them are unacceptable to you, the decision is already made.

**Administration route.** Some are oral or nasal. Many are injectable. Decide whether you are actually willing to inject before going further.

## Step 3 — Source it

This is covered in depth in *How to Verify a Peptide Source*, and it is the step where most of the real risk lives. Short version: demand a batch-matched third-party certificate of analysis, and treat unusually low prices as a warning rather than a deal.

## Step 4 — Understand what arrives

Most research peptides arrive as **lyophilized powder** — freeze-dried, usually a small amount of white residue at the bottom of a sealed glass vial. It often looks like almost nothing. That is normal; a 5mg quantity of powder is genuinely tiny.

You will also need, and these usually arrive separately:

- **Bacteriostatic water** — sterile water containing 0.9% benzyl alcohol as a preservative. This is what allows a vial to be used across multiple doses. Plain sterile water lacks the preservative and is intended for single use.
- **Insulin syringes** — typically U-100, marked in units rather than millilitres.
- **Alcohol swabs.**

## Step 5 — Reconstitute it

This is the step people are most nervous about and it is genuinely straightforward.

1. Let the vial reach room temperature if it has been refrigerated.
2. Swab the rubber stopper of both the peptide vial and the bacteriostatic water.
3. Draw your calculated volume of bacteriostatic water. The Reconstitution Calculator in the Dose Tracker will tell you exactly how much, and how many units each dose will be.
4. **Inject the water slowly down the inside wall of the vial.** Not directly onto the powder. A hard stream can damage the peptide.
5. **Swirl gently. Do not shake.** Shaking degrades peptide bonds. If it does not dissolve immediately, let it sit for a few minutes and swirl again.
6. Write the date on the vial.

Once reconstituted, refrigerate at 2–8°C.

## Step 6 — The first dose

**Start lower than the standard dose.** There is no benefit to starting at the top of a range and no way to know how you respond until you try. A conservative first dose costs you almost nothing and tells you what you need to know.

For a subcutaneous injection:

1. Wash hands. Swab the injection site — usually abdominal fat, a couple of inches from the navel.
2. Draw your dose. Tap out air bubbles.
3. Pinch a fold of skin.
4. Insert at roughly 45 degrees. The needle is very short and very thin.
5. Depress slowly, withdraw, apply light pressure.

Most people report feeling little or nothing. If something hurts sharply, stop.

**Rotate injection sites.** Repeatedly using the same spot causes tissue changes over time.

## Step 7 — Track it

Log every dose and note how you feel. The Dose Tracker exists for this.

The reason this matters: without a record, you cannot distinguish an effect from expectation, from a good week of sleep, from regression to the mean. Most people who believe a compound worked have no data supporting that, and most people who believe it did not have none either.

## Step 8 — Give it time, then actually evaluate

Most compounds need weeks, not days. Decide upfront how long you will run it and what result would count as success.

Then honestly assess against what you wrote down in step 1. If nothing changed, stopping is the correct decision — not increasing the dose because it "should" work.

## Things that go wrong

**Escalating too fast.** Higher doses usually mean more side effects rather than more benefit.

**Stacking immediately.** Running several new compounds at once means you cannot attribute any effect or any side effect to anything. Add one variable at a time.

**Ignoring a side effect.** People talk themselves out of taking symptoms seriously because they want something to work. Stop and reassess instead.

**Never stopping.** Every compound deserves a decision point. Running something indefinitely because you started is not a protocol, it is inertia.
`
},
{
  id:'read-research',
  cat:'Essential',
  catC:'#93C5FD',
  title:'How to Read Peptide Research Without Fooling Yourself',
  subtitle:'Why most exciting findings never translate, and how to judge evidence quality for yourself.',
  readTime:'9 min read',
  updated:'August 2026',
  body:`
## The core problem

Most claims about peptides trace back to a real study. That does not make them true in the way people repeat them.

A finding in mouse tissue becomes "clinically proven" through a chain of small distortions — a forum post drops the caveats, a vendor page drops the species, a video drops everything but the effect size. By the time it reaches you it sounds settled. It usually is not.

Learning to read the original claim is the difference between being informed and being marketed to.

## The evidence hierarchy

Not all studies carry the same weight. Roughly, from weakest to strongest:

**In vitro** — cells in a dish. Useful for identifying mechanisms. Says almost nothing about what happens in a living organism. A compound that kills cancer cells in a dish is a starting point for research, not a treatment.

**Animal studies** — usually rodents. Better, but the translation rate to humans is poor. Rodent physiology, dosing scale, and lifespan all differ substantially. Most compounds that work in mice do not work in people.

**Human observational** — watching what happens in people already doing something. Can identify correlations. Cannot establish that one thing caused another.

**Human RCT** — randomised controlled trial. Participants assigned randomly, ideally with neither them nor the researchers knowing who got what. This is the level where "this works" starts to be a defensible claim.

**Meta-analysis / systematic review** — combines many studies. Strongest, when the underlying studies are decent. A meta-analysis of weak studies is still weak.

When you see a claim, the first question is which of these it came from. Most peptide claims come from the top two tiers.

## Questions to ask about any study

**How many participants?** A finding in 12 people is a hypothesis. Small studies produce dramatic results by chance routinely.

**Was there a control group?** Without one, you cannot separate the compound from time passing, from placebo, from everything else that happened.

**Was it blinded?** People who know they received a treatment report improvement. This is not dishonesty, it is how perception works.

**Who funded it?** Industry-funded studies are not automatically invalid, but funding correlates with favourable outcomes. Worth knowing.

**Was it replicated?** A single striking result that no one has reproduced is common and usually does not survive.

**What dose, and by what route?** Animal studies often use doses far higher, relative to body weight, than anything a person would use. A finding at 10mg/kg in a mouse says little about 250mcg in a human.

## Specific traps in this space

**"Studied for decades" as a proxy for evidence.** Length of study history is not the same as strength of evidence. A compound can be researched for forty years and still lack good human trials.

**Mechanism mistaken for outcome.** "It upregulates VEGF, which promotes angiogenesis, which aids healing" is a plausible chain. Each link may be real and the end result may still not occur meaningfully in a person. Mechanism is a hypothesis about why something might work, not evidence that it does.

**Percentages without absolutes.** "Reduced risk by 50%" means something very different if the risk went from 4% to 2% versus 40% to 20%.

**Anecdote volume treated as data.** A hundred forum posts saying something worked is not a study. The people it did nothing for mostly did not post. This is survivorship bias and it is extremely strong in supplement and peptide communities.

**Conflating an approved drug with a research chemical version.** A pharmaceutical has verified dosing, purity, and clinical trial data behind it. The same molecule bought as a research chemical shares the mechanism but none of the verification.

## How to actually look something up

Every compound profile on Grounded links to PubMed, ClinicalTrials.gov, Europe PMC, and Google Scholar for that specific compound. Those searches are live, so they surface new work as it appears.

When you open a paper:

1. Read the **abstract** for the claim.
2. Check the **methods** for species, sample size, dose, and duration.
3. Read the **limitations** section. Researchers usually state the weaknesses honestly; it is the part marketing omits.
4. Note **who funded it**.

ClinicalTrials.gov is particularly useful because it shows trials that were registered and then produced no published results — which is itself informative.

## The reasonable position

Uncertainty is the normal state here. Most peptides sit in a genuinely unresolved space: promising mechanisms, thin human evidence, real but poorly quantified risk.

The useful stance is not "this works" or "this is nonsense." It is being able to say specifically what is known, what is inferred, and what is unknown — and making decisions that account for the size of that unknown.

That is less satisfying than certainty. It is also the only honest reading of the evidence as it currently stands.
`
},
{
  id:'reconstitution',
  cat:'Practical',
  catC:'#FCD34D',
  title:'Reconstitution, Storage, and Handling',
  subtitle:'The mechanical details that determine whether what you have is still active by the time you use it.',
  readTime:'7 min read',
  updated:'August 2026',
  body:`
## Why handling matters more than people expect

Peptides are chains of amino acids held together by bonds that are easier to break than most people assume. Heat, agitation, light, repeated freezing and thawing, and time all degrade them.

A vial handled carelessly can be substantially less active than the label suggests — and there is no visual difference. This is one of the more likely explanations when something produces no effect at all.

## Which water to use

**Bacteriostatic water** contains 0.9% benzyl alcohol, a preservative that inhibits bacterial growth. This is what allows a vial to be entered multiple times over weeks.

**Sterile water for injection** has no preservative. It is intended for single use. Using it for a multi-dose vial means anything introduced on the first entry has an uninhibited environment to grow in.

For anything you will use more than once, bacteriostatic water is the appropriate choice.

## How much water to add

There is no single correct volume. More water means a more dilute solution, which means larger, easier-to-measure injection volumes but a lower concentration.

The practical considerations:

- **Too little water** produces doses of one or two units, which are very difficult to measure accurately. Small measurement errors become large percentage errors.
- **Too much water** can produce a dose volume larger than your syringe holds.

The Reconstitution Calculator handles this arithmetic and will warn you in both directions — if your dose exceeds syringe capacity, or if it falls below roughly two units where accuracy degrades.

## The reconstitution procedure

1. **Bring both vials to room temperature.** Cold glass and temperature shock are avoidable stressors.
2. **Swab both rubber stoppers** with alcohol and let them dry.
3. **Draw your calculated volume** of bacteriostatic water.
4. **Angle the needle so the water runs down the inside wall of the vial.** Do not spray it directly onto the powder. The force of a direct stream can damage the peptide.
5. **Release the water slowly.** Do not push hard.
6. **Swirl gently, or roll the vial between your palms.** Never shake. Agitation breaks peptide bonds — this is the single most common handling mistake.
7. **If it does not dissolve immediately, wait.** Some compounds take several minutes. Let it sit and swirl again rather than forcing it.
8. **Label the vial with the reconstitution date.**

## What the solution should look like

Clear and colourless, for most compounds.

Stop and discard if you see:

- Cloudiness or haze
- Particles or floating material
- Discolouration
- Anything that fails to dissolve after extended time

Some compounds are exceptions — GHK-Cu, for instance, is genuinely blue because of its copper content. Check the specific compound profile before assuming a colour is wrong.

## Storage

**Before reconstitution (lyophilized powder):** generally stable. Many compounds tolerate room temperature for months, and refrigeration extends that. Keep away from light and heat.

**After reconstitution:** refrigerate at 2–8°C. Do not freeze reconstituted solution unless a specific protocol calls for it — ice crystal formation damages peptides, and repeated freeze-thaw cycles are worse than either state alone.

**Shelf life once mixed** varies by compound, commonly in the range of a few weeks. The compound profiles list specifics. This is why dating the vial matters.

**Travel:** an insulated container with a cold pack. Heat is the main risk. A vial left in a hot car can be effectively destroyed in a few hours.

## Sterility

Every entry into the vial is an opportunity to introduce contamination.

- Swab the stopper before every draw, not just the first
- Use a new needle each time
- Do not touch the needle to anything before it enters the vial
- Do not leave the vial open to air

Bacteriostatic water inhibits growth. It does not sterilise something that has been contaminated.

## Measuring accurately

Insulin syringes are marked in **units**, not millilitres. A U-100 syringe holds 1ml across 100 units, so one unit is 0.01ml.

The calculator converts your dose into units for the syringe type you are using. Small syringes are easier to read for small doses, which is why a U-30 or U-50 can be a better choice than a U-100 when doses are tiny.

**Tap out air bubbles before injecting.** A bubble displaces solution and means you receive less than intended.

## Common mistakes, in order of how often they happen

1. **Shaking instead of swirling.** Degrades the peptide immediately.
2. **Not dating the vial.** You will not remember, and "probably fine" is a guess.
3. **Spraying water directly onto powder.** Avoidable damage during the one step that matters most.
4. **Reusing needles.** Blunts the needle, which hurts more, and risks contamination.
5. **Storing reconstituted solution at room temperature.** Substantially shortens usable life.
6. **Freezing reconstituted solution.** Usually worse than refrigeration, not better.
`
}
];
