import './index.css';

import * as React from 'react';
import * as ReactDOM from 'react-dom';
import { SampleComponent } from './Component';
// import * as systema from '..';

const element = <div>
    <h1 class='test' style={{ color: 'red' }}>Hello, World!</h1>
    <SampleComponent />
</div>;

ReactDOM.render(element, document.body);
