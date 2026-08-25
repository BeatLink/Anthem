import { mount } from 'svelte'
import App from './App.svelte'
import '../../themes/halon/halon.css'
import './app.css'

mount(App, { target: document.getElementById('app')! })
