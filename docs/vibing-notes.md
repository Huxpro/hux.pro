# Vibing Engineering UI with AI 

## Starting with a Spec 

> SSD, Plan Mode

for UI task
- ask it to draw diagram (even given figma/screenshot)
- check its understanding 

for logic task
- yes, Model can think nowadays (CoT)
- still useful to ask it to print out so you can check

> No, you still need to think

## Experimentation (Tackling Randomness) (Feature Branching)

- multiple model
- multiple rounds

## Engineering: Make Architectural Decision Yourself (Make it Long-term Maintainable)

> Or: if you know engineering, that's better!

With bad eng decision (bad context management): LLM degrades really fast 

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


## Spec is now Code

Was it source? No, it was test.

Ask LLM to explain its architectures --> get back to "spec"

Spec is now the "code", "code" is now the artifacts


## Subagents?

Saving context, purpose-built -- think it as "other roles / teammates"
- Code reviewer (Language/React lawyer)
- Documentator 



## Verifiable still the Biggest Bottleneck 

With LLM being able to ReAct, as long as you can signal AI that something is broken, they can stay working FOREVER ("the infinite mind")

> "Self-driving Infrastructure"


### L1: Manual Q&A - Regression


### L2: TDD - Traditional Errors (Static Error, Runtime Exception)


### L3: Vision 


### L4: ??



## Asking for Better Infrastructure

### Locality

### Consistency 

### Verifiable 