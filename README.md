

# Oracle APEX GenAI Agent - WIP
A custom component designed for Oracle APEX. <br />
Providing a modern GenAI Agent that enables support for chatting with your data with Gemini Nano or local Custom Modals.

<img src="https://github.com/user-attachments/assets/c5f70c84-784b-420e-9c43-2baf49f3a018" width="350" />

# Architecture
...

# Installation
In your console goto the folder where you have this project and install it's dependencies.

```
npm install
```

## Launch Browser Interface
In your console run the following cmd to initialise a webserver
```
npm run dev
```
Once launched open a browser and head to http://localhost:5173

## Start Chat
In the bottom right corner you should see an icon - select it to load up the chat interface.<br />
You can now start chatting to Gemini Nano in your browser..


# prerequisites
You need to have the Gemini Nano in browser model running against window.ai<br /> 
_- we will shortly be adding fallback support for other local browser based LLMs such as Microsoft PHI that will run in any browser._

## Check if window.ai is setup in chrome

1. Open Chrome Dev Tools and in the console type "window.ai"
2. if window.ai is found you can skip the next step on setting up gemini nano

## Gemini-nano
Today window.ai is not officially available on the chrome browser and is currently part of Chrome Canary as an early preview of the integrated gemini-nano services.

Follow the following steps to enable Gemini Nano in Chrome Canary.

### Enable Gemini Nano in chrome canary

1. Open Chrome Canary and type "chrome://flags/" in the URL bar
2. In the search box type "prompt API"
3. Under "Prompt API for Gemini Nano" switch to "Enabled"
4. Update the search box to "optimization guide on"
5. Under "Enables optimization guide on device" switch to "Enabled ByPassPerfRequirement"

### Install/Update Gemini Nano

1. Open Chrome Canary and type "chrome://components/" in the URL bar
2. Find "Optimization Guide On Device Model"
3. Click "Check for Update" - this will download the LLM - 1.5gb and may take some time.
4. Restart Chrome

# Local LLMs made available 

## Gemini-Nano (Google)
Gemini is the result of large-scale collaborative efforts by teams across Google. It was built from the ground up to be multimodal, which means it can generalize and seamlessly understand, operate across and combine different types of information including text, code, audio, image and video.

Gemini Nano, the most efficient version of the Gemini family of LLMs, designed to run locally on most modern desktop and laptop computers. With built-in AI, your website or web application can perform AI-powered tasks without needing to deploy or manage its own AI models.

## Phi-3.5-mini (Microsoft)
Phi-3.5-mini is a lightweight, state-of-the-art open model built upon datasets used for Phi-3 - synthetic data and filtered publicly available websites with a focus on very high-quality, reasoning dense data.

The model belongs to the Phi-3 model family and supports 128K token context length. The model underwent a rigorous enhancement process, incorporating both supervised fine-tuning, proximal policy optimization, and direct preference optimization to ensure precise instruction adherence and robust safety measures.

Long Context
Phi-3.5-mini supports 128K context length, therefore the model is capable of several long context tasks including long document/meeting summarization, long document QA, long document information retrieval.

## Developed and Maintained by

_Philipp Hartenfeller_  
@ [https://hartenfeller.dev/](https://hartenfeller.dev/)

_John Sim_  
@ [https://bitmapbytes.com/](https://bitmapbytes.com/)
