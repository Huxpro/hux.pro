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

## Make Architectural Decision Yourself (Make it Long-term Maintainable)

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