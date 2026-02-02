# Holly Engineering Take-Home Assignment

## Overview

This take-home assignment is designed to evaluate your technical skills across several areas important to our engineering team. It's completely fine if you don't finish everything - we're more interested in understanding your approach and thought process.

## Important: AI Usage & Assessment Philosophy

**We're AI-friendly at Holly** - we use AI tools in our day-to-day work. However, this take-home assessment is specifically designed to evaluate **your individual problem-solving abilities and coding skills**.

When AI tools are heavily used, it becomes difficult for us to assess:

- How you think through problems and debug issues
- Your ability to refactor and maintain code
- Your understanding of the codebase and architectural decisions
- Your attention to detail and code quality

**Please use AI tools minimally, if at all.** We want to see your work, not AI-generated code. If you do use AI assistance, please clearly document what was AI-generated versus your own work in your submission writeup.

_(Yes, we're aware of the irony that this README was refined with AI assistance!)_

## Goals

This assignment evaluates your skills in:

1. **Data processing** - Efficiently filtering and matching data before sending to LLM
2. **Next.js development** - Understanding Next.js patterns and best practices
3. **LLM integration** - Properly structuring prompts and managing context
4. **TypeScript** - Type safety and proper typing throughout
5. **Code quality** - Clean, maintainable code with attention to detail

## Getting Started

1. Clone this repository to your local machine
2. Install dependencies
3. Understand the requirements
4. Start building!

## The Challenge

You'll build a simple chat interface that allows users to query job and salary information stored in JSON files. Think of it as a basic HR assistant that can answer questions about job descriptions and compensation. The interface doesn't have to be anything fancy.

## Requirements

### 1. Chat Interface

- Create a dedicated chat page (`/chat`) with a message interface
- Style the interface so human messages appear on the right and AI messages on the left (standard chat UI convention)
- The UI doesn't need to be elaborate - focus on functionality over aesthetics

![Sample Application](public/sample.png)

### 2. LLM Integration

- Integrate with an LLM of your choice
- The LLM should be able to answer questions about the data in the job descriptions and salaries datasets
- **Critical Requirement**: Your implementation should parse the user's query to identify which specific job they're asking about, and only pass the relevant job information to the LLM - do not pass the entire dataset to the LLM with each request
- Example queries and responses:
  - "What are the knowledge, skills, and abilities for the Assistant Sheriff San Diego County position?"
    - "The Assistant Sheriff in San Diego County should have knowledge of: local law enforcement agencies in San Diego County, local/state/federal laws, law enforcement rules and regulations, community-based policing..."
  - "What is the salary for the Assistant Chief Probation Officer in San Bernardino?"
    - "The Assistant Chief Probation Officer in San Bernardino has a salary range from $70.38 to $101.00 per hour (salary grades 1 and 2)."

## Technical Requirements

- Use Next.js for the application framework
- Implement proper TypeScript typing throughout the application
- Implement server actions where appropriate
- **Do not use fuzzy string matching libraries** (e.g., Levenshtein distance, fuzzywuzzy, string-similarity) for matching user queries to job records. We want to see your approach to handling query variations.

## Evaluation Criteria

We'll be evaluating:

1. **Data Processing Efficiency** - How efficiently you process and filter data before sending to the LLM (this is a key evaluation point)
2. **Matching Strategy** - Your approach to matching user queries to job records without fuzzy matching - we're interested in seeing creative and effective solutions
3. **Code Quality** - Clean, maintainable code without debug artifacts
4. **Attention to Detail** - Accurate understanding of the data and consistent documentation
5. **Problem-Solving Approach** - How you think through challenges and make architectural decisions

## Submission

**Please submit within 3 days** of receiving this assignment. We encourage you to spend only a few hours working on it - we want to gauge your thought process and problem-solving approach, not see a polished production-ready application.

Please submit:

1. The complete codebase in a public GitHub repository
2. **Clear, accurate instructions** for running the application locally
3. A brief writeup explaining:
   - Your approach and technologies used
   - Any challenges you faced
   - **What parts, if any, were AI-assisted** - being transparent about this helps us better understand your thought process and decision-making

## Notes

- Focus on demonstrating your understanding of Next.js patterns, TypeScript, and clean code organization
- Don't spend too much time on UI aesthetics - functionality is the priority
- **We'll be evaluating how efficiently you process and filter data before sending to the LLM** - this is a core requirement

