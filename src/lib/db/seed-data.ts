export type SeedCategory = {
  id: string
  slug: string
  name: string
  description: string
  intro: string
  accent: string
  sortOrder: number
}

export type SeedAuthor = {
  id: string
  slug: string
  displayName: string
  roleTitle: string
  bio: string
  longBio: string
  expertise: string[]
}

export type SeedTag = { id: string; slug: string; name: string; description: string }

export type SeedArticle = {
  id: string
  slug: string
  title: string
  subtitle: string | null
  categoryId: string
  authorId: string
  status: 'draft' | 'scheduled' | 'published'
  publishedAt: string | null
  scheduledFor?: string | null
  featured?: boolean
  featuredRank?: number | null
  pick?: boolean
  tags: string[]
  seoTitle?: string | null
  seoDescription?: string | null
  body: string
}

export const seedCategories: SeedCategory[] = [
  {
    id: 'cat_technology',
    slug: 'technology',
    name: 'Technology',
    description: 'Software, tools, and the systems we build around them.',
    intro:
      'Notes on the machinery of everyday work: the tools we reach for, the systems we inherit, and the quiet decisions that make software last.',
    accent: 'indigo',
    sortOrder: 1,
  },
  {
    id: 'cat_ai',
    slug: 'artificial-intelligence',
    name: 'Artificial Intelligence',
    description: 'Machines that guess, and the people who decide.',
    intro:
      'A working notebook on machine learning and its interfaces — what these systems can reasonably claim, and what remains a matter of human judgement.',
    accent: 'ultramarine',
    sortOrder: 2,
  },
  {
    id: 'cat_design',
    slug: 'design',
    name: 'Design',
    description: 'Interfaces, typography, and the craft of making things legible.',
    intro:
      'On the visual and verbal decisions that shape how something feels to use. Less about decoration, more about clarity, rhythm, and intent.',
    accent: 'vermilion',
    sortOrder: 3,
  },
  {
    id: 'cat_business',
    slug: 'business-work',
    name: 'Business & Work',
    description: 'How work is organised, priced, and sustained.',
    intro:
      'Essays on the economics of making things: maintenance, incentives, small firms, and the parts of work that rarely make it into a slide.',
    accent: 'ochre',
    sortOrder: 4,
  },
  {
    id: 'cat_science',
    slug: 'science',
    name: 'Science',
    description: 'Curiosity, evidence, and the stories we tell about both.',
    intro:
      'Reading notes on how knowledge is made — the slow accumulation of evidence, the usefulness of uncertainty, and the metaphors that carry ideas.',
    accent: 'teal',
    sortOrder: 5,
  },
  {
    id: 'cat_culture',
    slug: 'culture',
    name: 'Culture & Media',
    description: 'What we read, watch, and pass along.',
    intro:
      'Observations on the culture of reading and watching: the shape of feeds, the value of endings, and the things worth recommending.',
    accent: 'plum',
    sortOrder: 6,
  },
  {
    id: 'cat_productivity',
    slug: 'productivity',
    name: 'Productivity',
    description: 'Attention, habits, and humane ways to get things done.',
    intro:
      'Practical notes on working with attention rather than against it. Systems that survive a bad week, and rituals that do not require an audience.',
    accent: 'moss',
    sortOrder: 7,
  },
  {
    id: 'cat_personal',
    slug: 'personal',
    name: 'Personal',
    description: 'Notebook entries, walks, and things worth keeping.',
    intro:
      'The looser pages of the publication: observations, walks, reading notes, and whatever else has been turning over for a while.',
    accent: 'clay',
    sortOrder: 8,
  },
]

export const seedAuthors: SeedAuthor[] = [
  {
    id: 'author_mira',
    slug: 'mira-vale',
    displayName: 'Mira Vale',
    roleTitle: 'Editor',
    bio: 'Writes about software, design, and the habits of attention. Demonstration author profile created for this prototype.',
    longBio:
      'Mira keeps this publication. Her essays tend to start with a small observation — a menu that feels wrong, a notebook that stops being used, a feature nobody asked for — and work outward from there. This biography is a demonstration profile for the Commonplace prototype, not a real person, and no credentials are implied.',
    expertise: ['software', 'design', 'attention', 'interfaces'],
  },
  {
    id: 'author_tobias',
    slug: 'tobias-reed',
    displayName: 'Tobias Reed',
    roleTitle: 'Contributing editor',
    bio: 'Notes on business, systems, and the craft of making things. Demonstration author profile created for this prototype.',
    longBio:
      'Tobias writes about systems that last longer than their authors expect. His interests include maintenance, small firms, and the economics of doing a thing carefully. This biography is a demonstration profile for the Commonplace prototype.',
    expertise: ['systems', 'maintenance', 'business', 'craft'],
  },
  {
    id: 'author_ines',
    slug: 'ines-ferrer',
    displayName: 'Inés Ferrer',
    roleTitle: 'Contributing editor',
    bio: 'Essays on science, culture, and the odd corners of everyday life. Demonstration author profile created for this prototype.',
    longBio:
      'Inés reads widely and takes notes in the margins. Her pieces move between science, culture, and the small rituals of a working life. This biography is a demonstration profile for the Commonplace prototype.',
    expertise: ['science', 'culture', 'memory', 'reading'],
  },
]

export const seedTags: SeedTag[] = [
  { id: 'tag_attention', slug: 'attention', name: 'Attention', description: 'The practice of paying attention to what is in front of you.' },
  { id: 'tag_systems', slug: 'systems', name: 'Systems', description: 'Structures that shape behaviour long after they are built.' },
  { id: 'tag_craft', slug: 'craft', name: 'Craft', description: 'Doing a thing carefully, for its own sake.' },
  { id: 'tag_tools', slug: 'tools', name: 'Tools', description: 'Instruments, editors, and everyday machinery.' },
  { id: 'tag_language', slug: 'language', name: 'Language', description: 'Words, naming, and the metaphors that carry ideas.' },
  { id: 'tag_interface', slug: 'interface', name: 'Interface', description: 'The surface where people meet systems.' },
  { id: 'tag_memory', slug: 'memory', name: 'Memory', description: 'What we keep, forget, and return to.' },
  { id: 'tag_reading', slug: 'reading', name: 'Reading', description: 'Books, essays, and habits of reading.' },
  { id: 'tag_work', slug: 'work', name: 'Work', description: 'How work is organised and sustained.' },
  { id: 'tag_automation', slug: 'automation', name: 'Automation', description: 'What machines take over, and what they leave behind.' },
  { id: 'tag_uncertainty', slug: 'uncertainty', name: 'Uncertainty', description: 'Living and working without perfect information.' },
  { id: 'tag_cities', slug: 'cities', name: 'Cities', description: 'Streets, buildings, and the life between them.' },
  { id: 'tag_maintenance', slug: 'maintenance', name: 'Maintenance', description: 'The work that keeps things working.' },
  { id: 'tag_culture', slug: 'culture', name: 'Culture', description: 'The things we read, watch, and pass along.' },
]

export const seedArticles: SeedArticle[] = [
  {
    id: 'art_01',
    slug: 'the-return-of-the-commonplace-book',
    title: 'The Return of the Commonplace Book',
    subtitle:
      'For centuries, readers kept private anthologies of what moved them. The habit is older than the internet — and more useful than most of our software.',
    categoryId: 'cat_personal',
    authorId: 'author_mira',
    status: 'published',
    publishedAt: '2026-10-08T08:30:00.000Z',
    featured: true,
    featuredRank: 1,
    tags: ['reading', 'memory', 'attention', 'craft'],
    seoTitle: 'The Return of the Commonplace Book',
    seoDescription:
      'A note on commonplace books, the old practice of keeping a personal anthology, and what it offers a reader with too many open tabs.',
    body: `There is a particular kind of notebook that has no obvious purpose. It is not a diary, because it does not follow the calendar. It is not a journal of ideas, because most of the ideas belong to other people. It is a place where a reader copies out the sentences that caught, with no promise that anyone will ever read them again.

For a few centuries, this was simply called keeping a commonplace book. Readers collected passages, arranged them under headings, and returned to them. The form was practical: a way to hold on to what mattered before it disappeared. It was also, quietly, a way of thinking. Copying a sentence by hand forces a kind of attention that reading alone does not.

## A book made of other books

The commonplace book is a form built out of affection. You take what someone else wrote, place it beside something else, and a third thing appears in the space between them. The value is not in the completeness of the collection. It is in the arrangement — the fact that a paragraph about cities sits next to a paragraph about memory because they seemed, on a particular afternoon, to be talking to each other.

This is why the practice resists most attempts to automate it. A folder of saved links is a collection. A commonplace book is an argument you are having with yourself over time.

> The notebook is not an archive. It is a conversation with the person you were when you first underlined the sentence.

## Why the habit survived

The habit survives because reading is not primarily an act of storage. It is an act of noticing. When a sentence stops you, something in your own thinking has moved. The notebook is where that movement is recorded.

There are only a few things I have found that a good commonplace book does:

- It slows reading down just enough to make disagreement possible.
- It gives old interests a way to re-enter the present.
- It makes it difficult to pretend you have read something you have not.
- It keeps you honest about what you actually find beautiful, as opposed to what you are supposed to find important.

That last point is the one I return to. A private notebook has no audience to impress. Left alone with our own taste for long enough, most of us discover that it is stranger and more specific than we admit in public.

## The digital version is not a database

Most note-taking software is designed around retrieval. It assumes that the problem is finding things again, and it builds elaborate systems of tags and backlinks to solve that problem. But the problem of a commonplace book is not retrieval. It is attention.

A database rewards accumulation. A notebook rewards revisiting. These are not the same behaviour, and software rarely makes the difference visible. The tools that suit the practice are usually the ones that feel slightly too simple: a plain document, a folder, a physical book with a ribbon in it.

![A quiet page of collected notes](media:cover01 "Collected fragments, kept together by association rather than category.")

## A small practice

If you want to start, the requirements are modest. Choose one place. Do not organise it beyond the point of use. When you copy something, add one sentence explaining why it stopped you. Re-read the notebook at the end of the month, without adding anything.

The last instruction is the important one. Most of what we save is never seen twice, which means most of what we save is not really a commonplace at all. It is a receipt for having been briefly interested. The return visit is what turns a pile of fragments into a record of a mind changing.`,
  },
  {
    id: 'art_02',
    slug: 'what-we-talk-about-when-we-talk-about-interfaces',
    title: 'What We Talk About When We Talk About Interfaces',
    subtitle:
      'Every product has a theory of the person using it. Interfaces are where that theory becomes visible.',
    categoryId: 'cat_design',
    authorId: 'author_mira',
    status: 'published',
    publishedAt: '2026-10-21T07:45:00.000Z',
    featured: false,
    pick: true,
    tags: ['interface', 'language', 'craft'],
    seoDescription:
      'An essay on interfaces: the words, affordances, and unspoken assumptions that decide whether something feels considerate or merely clever.',
    body: `An interface is a sentence spoken to someone who is trying to do something else. That is the whole difficulty. The person is not thinking about the interface; they are thinking about the invoice, the photograph, the message they are late in sending. Whatever the design says, it is being read in the middle of another life.

This is why the best interface work often feels less like invention and more like removing obstacles from a conversation. The tool should make the next step obvious without making a performance of it.

## Words are the material

Designers tend to discuss colour and spacing, but most interfaces are made of language. "Save", "done", "continue", "submit" — each of these implies a different model of what just happened. A button that says "submit" tells you that you are handing something to an authority. A button that says "publish" tells you that a thing will become public. Two words, two entirely different rooms.

> Naming is not the decoration of an interface. Naming is where the interface decides what kind of situation you are in.

The work is to use the plainest possible word for the thing being done, and then to live with the plainness. Much of what passes for personality in software is actually vagueness with better typography.

## The honesty of constraints

There is a strange pleasure in using a tool that knows what it is for. It does not offer you every possible view of the material; it offers you the one that suits the task. The constraint is not a limitation but a form of attention. Someone decided that this moment — reading, writing, choosing — deserved a particular kind of quiet, and then made the quiet.

A useful test for any screen: remove everything that is not necessary to make the next decision. What remains is the interface. If nothing remains, the problem was not visual.

## Three questions

When something feels wrong to use, I try to narrow it down:

1. What is this screen asking me to believe about myself?
2. Which words are doing work, and which are hiding behind familiarity?
3. If I had to explain this action to a friend in one sentence, what would I say?

The third question is usually the most revealing. If the explanation is longer than the action, the interface is carrying too much theory. The user came to send a message, not to learn a model of communication.

## Invisible, not absent

Good interfaces disappear in use, which makes them difficult to discuss and easy to underpay. The work looks like the absence of work. But invisibility is not the same as absence. Someone chose where the button would sit, how the error would sound, what would happen when the connection drops.

That is the quiet ambition of design: to let the person finish their sentence.`,
  },
  {
    id: 'art_03',
    slug: 'small-systems-long-lifetimes',
    title: 'Small Systems, Long Lifetimes',
    subtitle:
      'The software most likely to still be running in ten years is rarely the software that looked most exciting on the day it launched.',
    categoryId: 'cat_technology',
    authorId: 'author_tobias',
    status: 'published',
    publishedAt: '2026-09-24T09:10:00.000Z',
    featured: true,
    featuredRank: 3,
    tags: ['systems', 'tools', 'craft', 'maintenance'],
    seoDescription:
      'Notes on durable software: boring tools, small surfaces, and the maintenance habits that let a system outlive its original ambitions.',
    body: `Every system begins with an argument about the future. Someone believes this thing will be used for years, and someone else believes it will be replaced long before then. The architecture that follows is usually a bet about which of those people is right.

The systems I have seen survive are not the most elegant. They are the ones whose owners kept making small, unglamorous decisions in the same direction for a long time.

## Durable is a property of maintenance

There is a romantic story about software that lasts because it was designed perfectly at the start. The story is mostly false. Systems last because someone continued to understand them. They last because the parts can be replaced, because the failures are legible, and because the team resisted adding one more thing to the middle of it.

Durability is not a feature you ship. It is a practice you keep.

## The case for the smallest surface

A small system has fewer places for the world to disagree with it. It has fewer endpoints, fewer states, fewer assumptions about how it will be used. This is not minimalism for its own sake; it is a way of keeping the system comprehensible when the original authors are gone.

Here is the whole of a small status endpoint I once kept running for years:

~~~ts
// The smallest useful version of a "status" endpoint.
export function status() {
  return {
    ok: true,
    version: "1.4.0",
    checkedAt: new Date().toISOString(),
  };
}
~~~

It is not interesting. That is the point. It answered the only question anyone actually asked — is the service alive — without requiring a meeting to explain itself.

## Questions before adding a dependency

| Question | Why it matters |
| --- | --- |
| What happens if this disappears? | Abandoned packages are a maintenance cost disguised as convenience. |
| Can I read the whole thing? | If not, you are adopting an institution, not a library. |
| What is the upgrade path? | The first version is free. The second version is the price. |
| Does it remove more code than it adds? | Dependencies are only a good trade if the surface shrinks. |

None of these questions are about quality. They are about ownership. A dependency is a relationship with strangers that you will be asked to renew at the least convenient moment.

## Boring is a technical achievement

We use "boring" as an insult, but in infrastructure it is closer to a compliment. Boring means the behaviour is understood. Boring means the failure modes are known. Boring means a new person can be trusted with it on a Tuesday.

The interesting work can happen at the edges: in the interface, in the language, in the part a person actually touches. The centre of the system should be as dull as possible.

A system that lasts is not a monument. It is a habit that a group of people agreed to keep.`,
  },
  {
    id: 'art_04',
    slug: 'the-quiet-economics-of-maintenance',
    title: 'The Quiet Economics of Maintenance',
    subtitle:
      'The work that keeps things working is paid for in budgets, but it is argued for in values.',
    categoryId: 'cat_business',
    authorId: 'author_tobias',
    status: 'published',
    publishedAt: '2026-10-30T10:20:00.000Z',
    tags: ['work', 'systems', 'craft'],
    seoDescription:
      'An essay on maintenance work: why organisations underinvest in keeping things good, and how to argue for it anyway.',
    body: `A building does not stay a building by itself. Someone cleans the gutters, replaces the seal on a window, notices that a step has begun to move. None of this appears in the photograph of the finished building. All of it is the reason the photograph can still be taken a decade later.

Software has the same shape, but a worse relationship with it. Maintenance is not a launch. It does not produce an announcement. It is difficult to photograph and almost impossible to put on a roadmap without someone asking whether it is really necessary this quarter.

## The invisibility dividend

Good maintenance is invisible twice: once while it is being done, and once when the disaster does not happen. This creates a peculiar accounting problem. The team that prevents an outage has no incident to point to. The team that spends a year simplifying a system has no new feature to demo. The value is real, but it arrives as an absence.

Organisations tend to reward what can be presented. That is not cynicism; it is how attention works. The maintenance argument has to be made in a different register — not "look what we shipped" but "look what we kept from breaking".

## Price and cost are not the same conversation

A useful distinction: price is what you pay now, cost is what the thing asks of you later. Cheap software often has an enormous cost, deferred to a person who has not yet been hired. Expensive software can be a bargain if it removes a class of future work.

> Every shortcut is a loan taken out against someone else's afternoon.

The person who pays it is usually less senior than the person who took it out. This is the ethical centre of maintenance, and it is rarely on the slide.

## What to do about it

There is no clever trick, but there are a few habits that help:

- Name the work. "Maintenance" as a bucket is easy to cut; "the login flow will fail when the certificate expires" is harder to ignore.
- Put it in the same queue as features, with the same visibility.
- Track the second-order work: the support load, the manual steps, the exceptions people have learned to make.
- Celebrate the removal of complexity as loudly as the addition of capability.

The last one matters more than it sounds. If the only visible act is addition, the system will only ever grow.

## A longer horizon

Maintenance is not a phase that follows building. It is the condition under which building becomes useful. A thing is finished, in any meaningful sense, only when someone is still taking care of it.

The organisations I admire most are the ones where this is not a difficult argument — where keeping a thing good is treated as part of the job rather than an interruption of it. They are not more sentimental. They have simply noticed that the bill arrives either way.`,
  },
  {
    id: 'art_05',
    slug: 'a-field-guide-to-noticing',
    title: 'A Field Guide to Noticing',
    subtitle:
      'Attention is not a resource to be managed. It is a practice, and like any practice it improves with repetition.',
    categoryId: 'cat_personal',
    authorId: 'author_ines',
    status: 'published',
    publishedAt: '2026-09-12T06:40:00.000Z',
    tags: ['attention', 'cities', 'craft'],
    seoDescription:
      'A short field guide to the practice of noticing: walks without destinations, descriptions instead of opinions, and the discipline of looking twice.',
    body: `The first thing to say about noticing is that it is not the same as looking. Looking is what happens when your eyes are open. Noticing is what happens when you agree, for a moment, to be answerable for what is in front of you.

Most of us move through the day on a kind of summary. We know there is a tree on the corner without seeing it. We know the train is late without reading the announcement. The summary is efficient, and it is also how a life becomes a series of transitions between screens.

## Start with a walk

The oldest method is a walk with no destination. Not a walk to the shop, not a walk for exercise, but a walk whose only instruction is to go somewhere and come back. The absence of a goal changes the quality of the attention. Nothing is on the way to anything.

On such a walk, I try to collect three things:

1. One thing I have passed a hundred times and never described.
2. One sound that is not a machine.
3. One thing that has changed since the last time I looked.

The list is arbitrary. Its purpose is to give the mind a small task, the way a child is given a job on a long car journey.

## Description before opinion

The second discipline is harder: describe before you judge. It is tempting to say a building is ugly, a street is characterless, a sign is badly designed. The opinion arrives quickly and closes the subject.

A description keeps the subject open. What colour is the brick? Where does the light fall at four in the afternoon? Which windows have curtains and which have blinds? The answers are not profound, but they are evidence, and evidence is what opinions are supposed to rest on.

> The world is full of things that have never been described, only named.

## Repetition is the whole trick

Noticing is not a talent. It is a habit of returning. The same street looks different on a wet Tuesday, and again in the week before a holiday, and again after the shop on the corner closes. None of these differences are visible from a single visit.

This is why travel photographs so often feel thinner than the place itself. We notice intensely for a few days and then leave before the repetitions begin. The repetitions are where a place stops being scenery and becomes a life.

## A small ledger

I keep a page in my notebook for things noticed: not thoughts, not plans, just descriptions. A woman teaching a dog to wait at a crossing. The particular green of a door. The way a queue rearranges itself when a second till opens.

Re-read at the end of the month, the list is not impressive. It is something better than impressive. It is specific.`,
  },
  {
    id: 'art_06',
    slug: 'machines-that-guess-people-who-decide',
    title: 'Machines That Guess, People Who Decide',
    subtitle:
      'Probabilistic systems are useful precisely because they are uncertain. Confusing that with authority is where things go wrong.',
    categoryId: 'cat_ai',
    authorId: 'author_mira',
    status: 'published',
    publishedAt: '2026-11-02T09:00:00.000Z',
    tags: ['automation', 'uncertainty', 'interface', 'systems'],
    seoDescription:
      'An essay on working with probabilistic systems: designing for doubt, keeping human judgement in the loop, and resisting the language of certainty.',
    body: `A language model does not know anything in the way a person knows a phone number. It has learned the shape of statements that tend to follow other statements. This is a real and useful kind of competence, and it is not the same as knowledge. Most of the difficulty in using these systems well comes from forgetting the difference.

The trouble is not that the machine is wrong. It is that it is confident in a voice we have spent centuries learning to trust.

## The grammar of certainty

Human language carries many small signals of reliability. We say "I think", "probably", "someone told me", "I would check that". These are not hesitations; they are calibrations. They tell the listener how much weight to put on what follows.

A generated answer often lacks these signals. It arrives in the register of a finished thing, with the fluency of a paragraph that has been edited. The fluency is doing rhetorical work that the content has not earned.

> The most important interface question for a guessing machine is not "what can it do?" but "how does it show what it does not know?"

## Designing for doubt

I have come to think that the useful patterns here are old ones. Weather forecasts show a percentage. Maps distinguish roads from footpaths. A good scale says "about" when it means about.

For model outputs, this suggests a few practical moves:

- Show the source material, not just the conclusion, whenever the answer is checkable.
- Make the difference between "found" and "generated" visible at the point of use.
- Keep a human decision at any step where the cost of being wrong is not reversible.
- Treat the system's explanation as a summary of its output, not as evidence about the world.

None of this is exotic. It is the ordinary discipline of not letting a tool's confidence become your own.

## Where these systems genuinely help

The most convincing uses I have seen are not the ones that replace a judgement. They are the ones that reduce the cost of producing a first draft, or searching a large space, or noticing a pattern that a person would have to read too much to see.

These are tasks with a natural check. A draft can be read. A search result can be verified. A pattern can be tested against the material. The model is a collaborator in the early, rough part of the work, and a person remains responsible for the part that decides.

## The name of the thing

Language matters here more than usual. "Artificial intelligence" is a marketing phrase that has hardened into a category. It encourages us to imagine a mind on the other side of the screen, with intentions and an inner life, when what is on the other side is a statistical artifact shaped by an enormous amount of human writing.

The artifact can be astonishing. It can also be wrong in ways that no amount of fluency will fix. A useful relationship with it begins with the plainest possible description: this is a machine that guesses, and I am the person who decides what to do with the guess.`,
  },
  {
    id: 'art_07',
    slug: 'the-half-life-of-a-good-idea',
    title: 'The Half-Life of a Good Idea',
    subtitle:
      'Ideas do not stay useful by being stored. They stay useful by being revisited at the right distance.',
    categoryId: 'cat_science',
    authorId: 'author_ines',
    status: 'published',
    publishedAt: '2026-08-19T08:15:00.000Z',
    tags: ['memory', 'reading', 'uncertainty'],
    seoDescription:
      'On forgetting, resurfacing, and why the notes you keep are only as useful as the paths back to them.',
    body: `There is a moment, shortly after finishing a good book, when the ideas in it feel permanently available. You could explain the argument. You could quote a line. A month later, you remember that the book was good and roughly what it was about. A year later, you remember the cover.

This is not a failure of character. It is what memory does. It keeps the shape and lets the detail go, on the reasonable assumption that the detail can be recovered if it matters. The question for anyone who reads seriously is whether there is a route back.

## Notes are paths, not containers

Most note-taking advice begins with storage: where to put things, how to tag them, which app to use. But a note that cannot be found again is not a note. It is a receipt.

The useful question is not "where does this belong?" but "what will bring me back here?" A single sentence about why a passage mattered is often more valuable than the passage itself, because it records the connection that was live on the day you read it.

> Forgetting is not the enemy of a notebook. Inaccessibility is.

## Distance makes ideas legible

Re-reading something immediately is usually just confirmation. You agree with it because you still remember agreeing. The interesting re-reading happens at a distance — long enough that the context has faded, short enough that the shape can still be recovered.

In practice, this suggests a rhythm rather than a system:

- Capture quickly, with as little ceremony as possible.
- Revisit monthly, without trying to be comprehensive.
- Keep the notes that still produce a reaction; let the rest go.
- When something keeps returning, give it a longer piece of writing of its own.

The last step is how a note becomes an idea. Repetition is a signal that the material is doing work in your thinking, and the work deserves a better home than a folder.

## The usefulness of being wrong

One of the pleasures of old notes is discovering that you were wrong. A confident opinion from two years ago, now embarrassing, is evidence that something has changed. Without the note, the change is invisible; you simply hold the new opinion and assume you always would have.

This is why I keep the awkward entries. The half-formed paragraph, the idea that did not work, the list of questions that no longer seem important. They are not a record of achievement. They are a record of movement, which is more useful.

## A modest conclusion

There is no method that will make you remember everything. The attempt to remember everything tends to produce a different failure: a system so elaborate that maintaining it displaces the reading it was meant to serve.

The modest alternative is to read, to keep a few traces, and to build a habit of returning. Not an archive. A path.`,
  },
  {
    id: 'art_08',
    slug: 'against-the-infinite-feed',
    title: 'Against the Infinite Feed',
    subtitle:
      'A feed has no ending, and an ending is what makes a body of work feel like a place.',
    categoryId: 'cat_culture',
    authorId: 'author_ines',
    status: 'published',
    publishedAt: '2026-10-15T11:05:00.000Z',
    tags: ['reading', 'attention', 'interface', 'culture'],
    seoDescription:
      'On finite publications, editorial pacing, and why the endless scroll quietly removes the satisfaction of finishing.',
    body: `A newspaper has an end. You can feel it in your hand: the pages thin out, the crossword appears, the last page is followed by the back of the last page. An issue of a magazine has a shape. Even a website, if it is built with any conviction, can have a bottom.

The infinite feed removed the bottom. In exchange, it offered more. More of the same, more of the adjacent, more of what the last thing suggested. It is difficult to argue with abundance. But a publication is not a pipe. It is a place, and places have edges.

## Pacing is an editorial act

When you put one piece after another, you are making a claim about how they should be read. A short note between two long essays is not just filler; it is a change of tempo. A section break is a chance to breathe. A front page is an argument about what matters today, and an argument can be wrong.

Algorithms are very good at relevance and very bad at tempo. They optimise for the next click, which is a different goal from making a sequence of things feel considered.

> The feed gives you more of what you liked. A publication gives you something you did not know to ask for.

## Finishing is a feature

There is a small satisfaction in coming to the end of something. It is not nostalgia; it is how attention closes a loop. You read the last paragraph, you sit with it for a moment, and you decide what you think.

An endless column never offers that moment. You leave when you are interrupted, not when you are finished. The reading ends in a small act of defeat, and the mind files the whole experience as unfinished.

## What to build instead

The alternative is not a return to paper. It is to design a finite thing:

- Choose a set of pieces for a day, a week, or an issue, and let that be the whole of it.
- Give the page a visible end, with somewhere to go next that is not just more.
- Let things be old. A good essay does not stop being good because it is not from today.
- Resist the temptation to make every visit a session.

None of this requires a moral crusade against social media. It requires only the recognition that a publication and a platform are different objects with different obligations. One is trying to keep you. The other is trying to leave you with something.

## The last page

The back page of a magazine is often the best-loved part. It is where the odd piece lives, the one that would not fit anywhere else. It works because it is last. Someone decided that this was the note to end on, and that decision gives the whole issue a shape.

A website can make that decision too. It is just harder to notice, because there is no cover to close.`,
  },
  {
    id: 'art_09',
    slug: 'how-to-keep-a-working-notebook',
    title: 'How to Keep a Working Notebook',
    subtitle:
      'A system that survives a bad week: capture loosely, review lightly, and keep the notebook where you can see it.',
    categoryId: 'cat_productivity',
    authorId: 'author_mira',
    status: 'published',
    publishedAt: '2026-09-02T07:20:00.000Z',
    tags: ['attention', 'tools', 'work', 'craft'],
    seoDescription:
      'A practical note on notebook systems: the four layers that matter, how to review them, and why elaborate setups fail.',
    body: `Most productivity systems fail for an unglamorous reason: they require a better week than the one you are having. They assume a morning routine, a tidy desk, and enough energy at the end of the day to file everything correctly. When those conditions disappear — and they always disappear — the system becomes another item on the list of things you are behind on.

A working notebook should be designed for the worst week, not the best one.

## Four layers are enough

Over the years I have settled on four layers. They are not a hierarchy of importance; they are a hierarchy of speed.

| Layer | Purpose | Review |
| --- | --- | --- |
| Inbox | Capture anything, in any form, in under ten seconds | Daily, briefly |
| Daily page | A place to think in sequence, with dates | As needed |
| Projects | One page per live thing, with the next action | Weekly |
| Reference | Material worth finding again, organised loosely | Monthly |

The inbox is the crucial layer. If capture is slow, the thought is lost, and a lost thought is worse than an untidy note.

## Capture in one move

The rule I try to follow is simple: when something occurs to me, it goes to one place, immediately, without a decision about where it belongs. Sorting is a separate job, done later, with less energy.

This sounds obvious and is surprisingly difficult. The temptation to file as you go is strong, because filing feels productive. But filing is a judgement, and judgements are expensive. The inbox exists to postpone judgement until it can be made cheaply.

> A notebook that requires you to decide where a thought belongs at the moment you have it is a notebook that will slowly stop being used.

## Review without ceremony

The daily review takes about two minutes. I look at the inbox, move anything that has a clear home, and leave the rest. The weekly review is longer: I open each project page, check whether the next action is still the next action, and close anything that has died.

The monthly review is the only one that feels like reading. I go back through the daily pages and look for patterns: what kept coming up, what I avoided, what turned out to matter. This is where the notebook earns its keep. The rest of the time it is a tool; in the monthly review it becomes a record.

## Keep it visible

The last piece of advice is physical. A notebook in a drawer is a filing system. A notebook on the desk is a habit. If you use software, put it in the dock; if you use paper, do not put it in a cover that makes it look too precious to write in.

The point is not the object. The point is that the next thought has somewhere obvious to land.

## A system that can be ignored

The best sign that a notebook is working is that you can ignore it for a few days and return without dread. A system that punishes absence will eventually be abandoned. A system that says "here is where you left off" will be picked up again.

Design for the return, not the streak.`,
  },
  {
    id: 'art_10',
    slug: 'the-anatomy-of-a-personal-website',
    title: 'The Anatomy of a Personal Website',
    subtitle:
      'A personal site is not a portfolio. It is a small piece of territory on the open web, and it should be built like one.',
    categoryId: 'cat_design',
    authorId: 'author_mira',
    status: 'published',
    publishedAt: '2026-11-04T08:05:00.000Z',
    featured: true,
    featuredRank: 2,
    pick: true,
    tags: ['interface', 'craft', 'tools', 'language'],
    seoDescription:
      'On building a personal website: what belongs on it, what to leave out, and why the small, unoptimised page still matters.',
    body: `A personal website is one of the few places online where no one is optimising you. There is no feed to satisfy, no engagement target, no growth loop. You can put something there because you want it to exist. That freedom is the entire point, and it is easy to lose.

The most common mistake is treating the site as a portfolio with a blog attached. A portfolio is an argument about your professional value. A personal site is a place. It can contain a portfolio, but it should not be organised around one.

## Start with the question

Before choosing a typeface, answer a simpler question: what do you want a visitor to be able to do? The answers are usually modest. Read something good. Understand what you are working on. Find a way to get in touch. Perhaps sign up for a letter.

Everything on the site should serve one of those answers. Everything else is decoration, and decoration has a cost — in maintenance, in attention, in the slow accretion of pages nobody updates.

## The pages that earn their place

A useful personal site tends to have a small number of durable sections:

- An index of writing, sorted by time, not by category.
- An about page written in the first person.
- A way to subscribe that does not require an account.
- A contact route that is not a form with seven fields.

That is close to the whole thing. Everything else — the reading list, the now page, the garden of notes — is optional, and optional is fine as long as it is honest.

## Let the page be simple

The technical temptation is to overbuild. A static page with clean HTML will outlive most frameworks, and it will still be readable when the build tool has been abandoned. Consider what a piece of writing actually needs:

~~~html
<article>
  <h1>The thing I made</h1>
  <p>A sentence about why it exists.</p>
  <p>Another sentence, with <a href="/notes">a link</a>.</p>
</article>
~~~

This is not an argument against tools. It is an argument for knowing what the tools are for. A build step that makes the writing slower to publish is a step in the wrong direction.

## Write for the archive

A personal site is read in two time horizons. The first is today, when someone arrives from a link. The second is years from now, when someone — possibly you — finds the page and tries to understand what it was about.

Writing for the archive changes the prose. It rewards specificity over timeliness. It makes you explain the context that a contemporary reader would already have. It makes you avoid the sort of joke that expires in a week.

> The web is full of pages written for an audience that has already moved on. The good ones are written for a reader who has not arrived yet.

## A small territory

The pleasure of a personal site is the pleasure of a small territory: you know where everything is, you decide what changes, and nothing arrives on the front page unless you put it there. It does not need to be impressive. It needs to be yours.`,
  },
  {
    id: 'art_11',
    slug: 'notes-on-walking-without-a-destination',
    title: 'Notes on Walking Without a Destination',
    subtitle: 'A short entry on the particular freedom of a walk that is not going anywhere.',
    categoryId: 'cat_personal',
    authorId: 'author_ines',
    status: 'scheduled',
    publishedAt: null,
    scheduledFor: '2026-11-09T08:00:00.000Z',
    tags: ['attention', 'cities'],
    seoDescription: 'A short note on walking without a destination.',
    body: `The walk began as an errand and then stopped being one. I had intended to buy a notebook, found the shop closed, and decided not to go home by the shortest route.

There is a kind of street you only see when you are not going anywhere: the yard behind the church, the alley that connects two roads you thought were parallel, the shop that sells only one thing and has been doing so for a very long time. None of it is remarkable. All of it is evidence that the city is larger than your route through it.

I walked for an hour and bought nothing. I came home with three sentences and a better sense of the shape of the neighbourhood. It is not much of an outcome, which is precisely why it was worth doing.

A walk without a destination is a small argument against the idea that every hour must produce something. The hour produced a walk.`,
  },
  {
    id: 'art_12',
    slug: 'the-useful-fiction-of-the-ten-year-plan',
    title: 'The Useful Fiction of the Ten-Year Plan',
    subtitle: 'A draft note on long horizons and the stories we tell to move in a direction.',
    categoryId: 'cat_business',
    authorId: 'author_tobias',
    status: 'draft',
    publishedAt: null,
    tags: ['work', 'uncertainty'],
    body: `A ten-year plan is not a prediction. It is a story that makes a direction feel concrete enough to act on.

The danger is not that the story is wrong. It is that we start treating it as a commitment, and then spend years protecting the story instead of responding to what is actually happening.

## A draft thought

Perhaps the useful version is a ten-year question rather than a ten-year plan: what kind of work do I want to be doing, and what would have to be true for that to be possible?

The question survives changes in circumstance. The plan does not.

This entry is unfinished. It is kept here because the questions are still open.`,
  },
  {
    id: 'art_13',
    slug: 'a-small-library-of-unfinished-things',
    title: 'A Small Library of Unfinished Things',
    subtitle: 'A draft on the projects we keep in drawers, and what they are actually for.',
    categoryId: 'cat_culture',
    authorId: 'author_ines',
    status: 'draft',
    publishedAt: null,
    tags: ['craft', 'memory'],
    body: `There is a shelf in my apartment for things I have not finished: a half-bound book, a piece of writing about a city I left, a piece of software that does one thing well and nothing else at all.

The shelf is not a reproach. It is a record of interest. Each object marks a moment when a question was alive enough to begin something, but not yet alive enough to continue.

## Unfinished is not failed

The culture of finished things makes it difficult to talk about work that stops. We describe it as abandoned, as if the only reason to start something is to complete it.

But many of the things on the shelf taught me what I needed to know before they stopped. The book taught me about paper. The software taught me about scope. The essay taught me what I actually thought, which turned out to be different from what I had planned to write.

## What the shelf is for

The shelf is a reminder that beginning is cheap and finishing is expensive, and that not every beginning owes the world a finish.

This entry is unfinished too.`,
  },
]
