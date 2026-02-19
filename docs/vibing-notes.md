# Vibing with Engineering

Hi, i'm Xuan. 
Not gonna talk about any of those today. 

## Theme

- Pratical engineering fundamental for vibe coders 
- Where engineering is still needed (and what's not)
- "AI didn't replace senior engineers and it invited everyone to be one."

## Key Take Away

- Learn High-level Engineering

### Outline

- Engineering? 
	- AI eliminates "some"
	- What are the other "some"?
		- if "coding" has been all, then Manager/High-level IC are not needed anymore.
			- they've been vibe coding all the time.
- Ch1. Managing AI like a "Manager"
  - Tackle the Context:
    - Direction Setting & Problem Framing 
  		- Starting with a Spec 
  			- You know what you want
  		- Iterative/Collaborative Research
  			- Plan mode give you something but ...
					- it can be too heavy
    			- You don't know what you want
	- Tackle the randomness/personality
  	- Make good use of your team (each has its own strength & weakness) 
  	- Parallel Exploration 
- Ch2. Thinking the System like an "Architect" (or Principal Eng)
  - Raise the bar; Coach it
		- Apply traditional engineering principles 
  		- DRY
		- Iteratively find the patterns/rules for your systems 
			- premature optimization
			- separation of concerns -> modularization
	- Understanding Outcomes & Managing Tradeoffs & Setting up constraints/guardrails
		- Performance
		- Correctness
			- Types, Tests, Protocols
		- Ease of debugging
  		- DevTool
		- Docs/Spec is now code 
- Closing thoughts

## Opening: Engineering? 

First of all, What do we mean by Engineering? 
- how many of you are actually in an eng job? Raise your hand

For the past decade, we've been think of the process of creating software as:

```md
Product -> Design --> Engineering 
                     (== Coding?)
```

It's only 10 month in since AC coined the term "Vibe Coding", and now 90% of the code is written by AI.

If AI can code, do we still need engineers?
- and if you are a vibe coder from an non-eng background, do you still need to learn the "engineering"?

I've been thinking about for a while, not just because of that i worried about my job security, but really,
as a developer infra folk, my job was about building the infra that human can use fluently.
but suddently AI is the best user, i need to rethink what's dev infra needs to be as well.

```md
我造 infra 给 human 用
    ↓
Human 需要 build fluency 才能用好
    ↓
AI 天生就有这个 fluency
    ↓
所以 "fluency" 不再是 engineering 的核心价值
    ↓
那什么才是？
    ↓
Managing AI = Managing Team 的 insight
    ↓
Protips
```

**When infra fluency is free, the focus of engineering is now something else.**


> "Engineer" 这个词来自拉丁语 ingenium（聪明才智）和 ingeniare（设计、发明）
最早的 engineers 是设计攻城器械和桥梁的人——重点是 problem solving + design，不是操作工具

(a large portion) of Seniority of engineering were defined by how fluent they use their tools (languages, lib like React, platform like Web/Lynx ... )

AI replaced the needs of "coding", and there are still things left.

In org:
- Manager / High-level IC are vibe coding all the time
	- they don't produce code.

So maybe: the engineering needed in the world of AI is what job responsibility often accounted by senior eng (and it's not just writing code)

> Managing AI is structurally equivalent to managing an engineering team.

### Protip 0: Managing AI as Leading an Eng team


## Context Setting / Onboarding

- rules
- Docs / Search
- institutional knowledge base via Skills/MCPs

## Role Setting

- git 

## Problem-Definition: Iterative vs. Starting with a Spec 

```md
The site currently uses a single OG image for all URLs.

Build a system that generates OG images so that each blog post and each API will have its own OG images.
```

### Spec / Plan Mode

- Prompt: "write me a X"
	- ??
- Spec: "let me breakdown X for you"
	- 我给你写好了 design doc
- Plan Mode: "break X down yourself (write me a design doc/PRD/RFC) and I'll review it"
	- 要求高级工程师“先想清楚再写” (think step-by-step)
	- what I don't like about it is that "it completes too fast"
		- if you don't review, then there is no difference.

> SSD, Plan Mode

for UI task
- ask it to draw diagram (even given figma/screenshot)
- check its understanding 

for logic task
- yes, Model can think nowadays (CoT)
- still useful to ask it to print out so you can check

>** No, you still need to think**

### ProTip 1. Ask first. 

> in real world, it often starts with a meeting to exchange thoughts.
> the senior eng will guide through the junior engs on what to even think about

Code quality wise: a clear spec can give much better code > iterative 

If you are not sure: no spec, try to "iterate your idea" by chatting with the agent (or really, any AI) before coding: it's good to chat with your IDE so that you have the context there for free.


## Managing Workforce: Prototyping / Experimentation (Tackling Randomness) (Feature Branching)

Say you are managing an engineering team, and you want to work on a problem with a tight timeline, and you have spare bandwidth (2 team members). What could you do? Well, you could ask different team members to do the same thing with different approaches. 

### Protip 2. Worktree 

Create multiple worktree - with Trae being subscription-based: just try more

- multiple model
- multiple rounds
	- even same model can write dramatically different code 
		- first round different, every message different (biased towards previous context)

parallel agentic coding,

Experiment with multiple worktree at once to experiment. 

power user feature -- now popularized 

https://stackoverflow.com/questions/31935776/what-would-i-use-git-worktree-for
https://www.reddit.com/r/ProgrammerTIL/comments/mtjg0c/git_til_about_git_worktrees/

VSCode just add first-class worktree support: https://code.visualstudio.com/docs/sourcecontrol/branches-worktrees#_working-with-git-worktrees
- https://code.visualstudio.com/docs/sourcecontrol/branches-worktrees#_working-with-git-worktrees
- https://code.visualstudio.com/updates/v1_103#_git-worktree-support

Cursor automatically creates and manages git worktrees for parallel agents. Each agent runs in its own worktree with isolated files and changes, so agents can edit, build, and test code without stepping on each other. To run an agent in a worktree, select the worktree option from the agent dropdown.[](https://cursor.com/blog/agent-best-practices)

## Setting Up Engineering Standards and Architectural Decision Yourself 

### Be the bar raiser

> Or: if you know engineering, that's better!

**With bad eng decision (bad context management): LLM degrades really fast **

### Protip 3: You need bar raiser (for the entire team) 

> making architectural decision is basically context management for future LLM

LLM tends to:
- write everything inline (in one file)
	- giant UI files
	- giant Data Model
	- giant `providers.tsx` and giant states
	- conflicting with "modular/composable" 
	- ask it to extract to libs / components
	- make architectural decision yourself
- write everything itself (reinventing wheels)
	- Yes: now you can customize
		- good examples: shadcn/ui, tailwind
	- No: you still need good foundation
		- data fetching lib
			- SWR / Cache persistence
		- routing / navigation 
		- UI primitives

> No, it's still better for you to review code to make sure it followed the engineering practices.
> when it makes surprsing decision - asking it why - you may find something you don't know

> Ask Ai to refactor for you.
> Asking good architecture questions

### Protip 4: Architecting is a Iterative Process.

Often, architecture evolves as more features are added - new logics emerges, needs of better architecture/abstraction emerged -> this is the time we need to refactor
- even in traditional human engineerign with really senior Architect -- architecture is not something that can be fully visioned (ofc it helps).
- that's why organiation needs "architect" role to constantly OVERSEEING the needs of rearchitectuing. 
- architecting is not a one-time job. It's a role, and we still need such role in agentic coding era 

> Software Engineering Principles still help. 
> We grew as "traditional programmers" gained those insights from manual programming, and there is currently a gap for vibe coders to get there ... (one of the reason junior devs had a hard time finding job)
> 
> but I believe next-gen programmers will be able to learn them from Agentic programming as well

Let me give you one examples: knows when to split module and when to consolidate things into one module ..

1. different React `Context` is better colocated with their features UI functionalities 
	1. so not a horizontal layer of abstraction 
2. different `Context` all registering to keyboard bindings -- hard to tell if there is a conflict or how to define priority in between them 
	1. we need a "global keyboard registry"

So it really boils down to logical abstraction above code level - which is something every senior engineers would have to develop those intuition through time and practices.

- Managing Dependencies 
- Setting up Constraints


--- 
You still need to define logics:
- types: mutually exclusive union
- compositions: subset 
- inheritance: parent -> child


Models:
- GPT: engineering-heavy
	- can be over-engineering (over complicating)
- Claude: outcome driven (RL, literal, humane)
	- can be over-simplify
		- it's like an employee be like "it's faster/shorter taking this path and trust me "
- Gemini 3 Pro:
	- Reall good at visual 

### ProTip 5: Spec is now the Source (of Truth)

Was it source? No, it was test.

Ask LLM to explain its architectures --> get back to "spec"

Spec is now the "code", "code" is now the artifacts 

Source code size is now the "code size" (artifact size): expect dead code


### Protip 6: Dedicated Role: Subagents?

Saving context, purpose-built -- think it as "other roles / teammates"
- Code reviewer (Language/React lawyer)
- Documentator 

## Understanding Outcomes & Managing Tradeoffs

### Protip 7: Performance

Challenges for Vibe Coder 

there are a lot of nuances here:
- a same seemingly outcome can be computed by different algorithms (time/space complexity)
- a same algorithm can be performed at different places (thus different outcomes)
	- client vs. server
	- main thread vs background

## Correctness: Verifiable still the Biggest Bottleneck 

With LLM being able to ReAct, as long as you can signal AI that something is broken, they can stay working FOREVER ("the infinite mind")

> "Self-driving Infrastructure"


Mobile Development - No Vision.

### L1: Manual Q&A - Regression


### L2: TDD - Traditional Errors (Static Error, Runtime Exception)


### L3: Vision 


### L4: ??


infra is currently a bottleneck for AI and I personally think it's now the biggest bottleneck that limits the ceiling of your "AI eng team".

We at ByteDance is heavily shifting toward an AI-first eng culture, and that's
why we are investing in Trae and Lynx.

## Closing: Aim High. Be Optimistic; Embrace AI.

1. as a human: meme: stair step


- AI will get you there
- We as tool developers (Trae, Lynx) will also help you get there.




### Locality

### Consistency 

### Verifiable 
